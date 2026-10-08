// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ guard: h.guard, getCurrentUser: h.getCurrentUser, json: h.json }));
vi.mock('@/lib/db', () => ({ pool: { connect: h.connect } }));

import { POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

// Departure 06:30 IST on Saturday 10 October 2026; it is now 08:05 IST that morning.
const departure = new Date('2026-10-10T06:30:00+05:30');
const now = new Date('2026-10-10T08:05:00+05:30');

function rideRow(change: Record<string, unknown> = {}) {
  return {
    state: 'scheduled',
    departure_start: departure,
    viewer_is_owner: true,
    viewer_is_rider: true,
    ...change,
  };
}

let ride: object | null;

function call(id = RIDE_ID) {
  return POST(new Request(`http://localhost/api/rides/${id}/complete`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/rides/[id]/complete'>);
}

const sqlCalls = () => h.clientQuery.mock.calls.map(([sql]) => String(sql).trim());

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  ride = rideRow();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.connect.mockResolvedValue({ query: h.clientQuery, release: h.release });
  h.clientQuery.mockImplementation((sql: string, params?: unknown[]) => {
    if (sql.includes('FOR NO KEY UPDATE')) return Promise.resolve({ rows: ride ? [ride] : [] });
    if (sql.includes('UPDATE rides')) {
      return Promise.resolve({ rows: [{ id: RIDE_ID, completed_at: params?.[1] }] });
    }
    return Promise.resolve({ rows: [] });
  });
});
afterEach(() => vi.useRealTimers());

describe('POST /api/rides/[id]/complete', () => {
  it('passes on the answer of the origin check and rate limit', async () => {
    h.guard.mockResolvedValue(Response.json({ error: 'Too many attempts.' }, { status: 429 }));
    expect((await call()).status).toBe(429);
    expect(h.guard).toHaveBeenCalledWith('complete-ride', 30, 900);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('requires sign-in', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Authentication required.',
      code: 'unauthenticated',
    });
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('answers "not found" for an ID that is not a UUID, without a query', async () => {
    const response = await call('abc');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Ride not found.', code: 'not_found' });
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('answers "not found" for a missing ride, and for one the user may not see', async () => {
    ride = null;
    expect((await call()).status).toBe(404);
    ride = rideRow({ viewer_is_owner: false, viewer_is_rider: false });
    expect((await call()).status).toBe(404);
    expect(sqlCalls().filter((sql) => sql === 'ROLLBACK')).toHaveLength(2);
    expect(h.release).toHaveBeenCalledTimes(2);
  });

  it('locks the ride and reads the user role in one query', async () => {
    await call();
    expect(sqlCalls()[0]).toBe('BEGIN');
    expect(sqlCalls()[1]).toContain('FOR NO KEY UPDATE');
    expect(h.clientQuery.mock.calls[1][1]).toEqual([RIDE_ID, USER_ID]);
  });

  it('refuses a rider with 403', async () => {
    ride = rideRow({ viewer_is_owner: false });
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Only the ride owner can mark it completed.',
      code: 'not_owner',
    });
    expect(sqlCalls()).not.toContainEqual(expect.stringContaining('UPDATE rides'));
    expect(sqlCalls()).toContain('ROLLBACK');
  });

  it.each([
    [
      'before departure starts',
      { departure_start: new Date('2026-10-10T09:00:00+05:30') },
      'too_early',
    ],
    ['when cancelled', { state: 'cancelled' }, 'cancelled'],
    ['twice', { state: 'completed' }, 'already_completed'],
  ])('refuses the owner %s with 409', async (_case, change, code) => {
    ride = rideRow(change);
    const response = await call();
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe(code);
    expect(sqlCalls()).not.toContainEqual(expect.stringContaining('UPDATE rides'));
    expect(sqlCalls()).toContain('ROLLBACK');
    expect(h.release).toHaveBeenCalledTimes(1);
  });

  it('marks the ride completed now and gives when rating closes, 72 hours later', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ride: {
        id: RIDE_ID,
        state: 'completed',
        completedAt: '2026-10-10T02:35:00.000Z',
        ratingClosesAt: '2026-10-13T02:35:00.000Z',
      },
    });
    const update = h.clientQuery.mock.calls.find(([sql]) => String(sql).includes('UPDATE rides'));
    expect(update?.[0]).toContain("state = 'completed', completed_at = $2");
    expect(update?.[1]).toEqual([RIDE_ID, now]);
    expect(sqlCalls().at(-1)).toBe('COMMIT');
    expect(h.release).toHaveBeenCalledTimes(1);
  });

  it('never sends user IDs back', async () => {
    const body = JSON.stringify(await (await call()).json());
    expect(body).not.toContain(USER_ID);
  });

  it('rolls back, releases the connection and answers 500 when the database fails', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.clientQuery.mockImplementation((sql: string) =>
      sql.includes('UPDATE rides')
        ? Promise.reject(new Error('connection lost'))
        : Promise.resolve({ rows: sql.includes('FOR NO KEY UPDATE') ? [ride] : [] }),
    );
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('server_error');
    expect(sqlCalls().at(-1)).toBe('ROLLBACK');
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
