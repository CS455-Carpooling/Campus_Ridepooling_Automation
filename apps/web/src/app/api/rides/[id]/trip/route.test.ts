// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  query: vi.fn(),
  runTripChange: vi.fn(),
  changeTripState: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));
vi.mock('@/lib/trip', () => ({
  changeTripState: h.changeTripState,
  TRIP_STAMP_SQL: 'TRIP STAMP SQL',
}));
vi.mock('@/lib/trip-api', () => ({ runTripChange: h.runTripChange }));

import { GET, POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

const ctx = (id = RIDE_ID) =>
  ({ params: Promise.resolve({ id }) }) as RouteContext<'/api/rides/[id]/trip'>;
const request = () => new Request(`http://localhost/api/rides/${RIDE_ID}/trip`, { method: 'POST' });

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.readJson.mockResolvedValue({ to: 'pickup_in_progress' });
  h.runTripChange.mockResolvedValue(Response.json({ ride: { id: RIDE_ID } }));
});

describe('GET /api/rides/[id]/trip (P-13)', () => {
  it('gives a seat holder the state and stamp', async () => {
    h.query.mockResolvedValue({ rows: [{ state: 'pickup_in_progress', stamp: 'abc' }] });
    const response = await GET(request(), ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'pickup_in_progress', stamp: 'abc' });
    expect(h.query).toHaveBeenCalledWith('TRIP STAMP SQL', [RIDE_ID, USER_ID]);
  });

  it('answers 404 to anyone without a seat and for a bad ID, and 401 when signed out', async () => {
    h.query.mockResolvedValue({ rows: [] });
    expect((await GET(request(), ctx())).status).toBe(404);
    expect((await GET(request(), ctx('nope'))).status).toBe(404);
    h.getCurrentUser.mockResolvedValue(null);
    expect((await GET(request(), ctx())).status).toBe(401);
  });
});

describe('POST /api/rides/[id]/trip (FR-RO-09.1, 09.4)', () => {
  it('moves the trip through runTripChange, as the signed-in user', async () => {
    const response = await POST(request(), ctx());
    expect(response.status).toBe(200);
    expect(h.guard).toHaveBeenCalledWith('trip-step', 30, 900);
    const [label, messages, run, body] = h.runTripChange.mock.calls[0];
    expect(label).toBe('Trip step');
    expect(messages).toHaveProperty('not_locked');
    await run('client');
    expect(h.changeTripState).toHaveBeenCalledWith(
      'client',
      RIDE_ID,
      USER_ID,
      'pickup_in_progress',
      expect.any(Date),
    );
    expect(body({ id: RIDE_ID })).toEqual({ ride: { id: RIDE_ID } });
  });

  it('refuses an unknown step with 400', async () => {
    h.readJson.mockResolvedValue({ to: 'scheduled' });
    const response = await POST(request(), ctx());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'invalid',
      fields: { to: expect.any(String) },
    });
    expect(h.runTripChange).not.toHaveBeenCalled();
  });

  it('passes on the rate limit, and answers 401 signed out and 404 for a bad ID', async () => {
    h.guard.mockResolvedValueOnce(Response.json({ error: 'Too many.' }, { status: 429 }));
    expect((await POST(request(), ctx())).status).toBe(429);
    expect((await POST(request(), ctx('nope'))).status).toBe(404);
    h.getCurrentUser.mockResolvedValue(null);
    expect((await POST(request(), ctx())).status).toBe(401);
    expect(h.runTripChange).not.toHaveBeenCalled();
  });
});
