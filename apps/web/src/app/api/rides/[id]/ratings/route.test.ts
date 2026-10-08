// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  submitRatings: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: h.json,
}));
vi.mock('@/lib/db', () => ({ pool: { connect: h.connect } }));
vi.mock('@/lib/ride-ratings', () => ({ submitRatings: h.submitRatings }));

import { POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';
const SEAT = 'a1a1a1a1-3333-4000-8000-000000000002';

function call(id = RIDE_ID) {
  return POST(new Request(`http://localhost/api/rides/${id}/ratings`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/rides/[id]/ratings'>);
}

const sqlCalls = () => h.clientQuery.mock.calls.map(([sql]) => sql);

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.readJson.mockResolvedValue({ ratings: [{ occupantId: SEAT, score: 4, comment: ' Kind. ' }] });
  h.connect.mockResolvedValue({ query: h.clientQuery, release: h.release });
  h.clientQuery.mockResolvedValue({ rows: [] });
  h.submitRatings.mockResolvedValue({ kind: 'rated', count: 1 });
});

describe('POST /api/rides/[id]/ratings', () => {
  it('passes on the answer of the origin check and rate limit', async () => {
    h.guard.mockResolvedValue(Response.json({ error: 'Too many attempts.' }, { status: 429 }));
    expect((await call()).status).toBe(429);
    expect(h.guard).toHaveBeenCalledWith('rate-ride', 60, 900);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('requires sign-in', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('unauthenticated');
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('answers "not found" for an ID that is not a UUID, without a query', async () => {
    const response = await call('abc');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Ride not found.', code: 'not_found' });
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('refuses a request the rules reject before touching the database', async () => {
    h.readJson.mockResolvedValue({ ratings: [{ occupantId: SEAT, score: 6 }] });
    const response = await call();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Give each person you rate a whole-number score from 1 to 5.',
      code: 'invalid_ratings',
    });
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('stores the checked ratings in a transaction and answers how many, nothing more', async () => {
    const response = await call();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ rated: 1 });
    expect(h.submitRatings).toHaveBeenCalledWith(
      expect.anything(),
      RIDE_ID,
      USER_ID,
      [{ occupantId: SEAT, score: 4, comment: 'Kind.' }],
      expect.any(Date),
    );
    expect(sqlCalls()).toEqual(['BEGIN', 'COMMIT']);
    expect(h.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ kind: 'not_found' }, 404, 'not_found'],
    [{ kind: 'window', window: 'not_completed' }, 409, 'not_completed'],
    [{ kind: 'window', window: 'cancelled' }, 409, 'cancelled'],
    [{ kind: 'window', window: 'closed' }, 409, 'closed'],
    [{ kind: 'self' }, 400, 'self_rating'],
    [{ kind: 'not_on_ride' }, 400, 'not_on_ride'],
    [{ kind: 'already_rated' }, 409, 'already_rated'],
  ])('answers %o with %i and rolls back', async (result, status, code) => {
    h.submitRatings.mockResolvedValue(result);
    const response = await call();
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.code).toBe(code);
    expect(typeof body.error).toBe('string');
    expect(sqlCalls()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(h.release).toHaveBeenCalledTimes(1);
  });

  it('says why a closed ride cannot be rated (US-RD-28 AC1)', async () => {
    h.submitRatings.mockResolvedValue({ kind: 'window', window: 'closed' });
    expect((await (await call()).json()).error).toBe(
      'Rating for this ride closed 72 hours after it was completed.',
    );
  });

  it('rolls back, releases the connection and answers 500 when the database fails', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.submitRatings.mockRejectedValue(new Error('connection lost'));
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('server_error');
    expect(sqlCalls()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(h.release).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });

  it('answers 500 when no connection can be had', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.connect.mockRejectedValue(new Error('pool exhausted'));
    expect((await call()).status).toBe(500);
    expect(h.release).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
});
