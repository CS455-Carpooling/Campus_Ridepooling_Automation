// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  runTripChange: vi.fn(),
  checkIn: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/trip', () => ({ checkIn: h.checkIn }));
vi.mock('@/lib/trip-api', () => ({ runTripChange: h.runTripChange }));

import { POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

const ctx = (id = RIDE_ID) =>
  ({ params: Promise.resolve({ id }) }) as RouteContext<'/api/rides/[id]/check-in'>;
const request = () =>
  new Request(`http://localhost/api/rides/${RIDE_ID}/check-in`, { method: 'POST' });

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.runTripChange.mockResolvedValue(Response.json({ seat: {} }));
});

describe('POST /api/rides/[id]/check-in (FR-RD-10.4)', () => {
  it('checks the signed-in rider in on this ride', async () => {
    expect((await POST(request(), ctx())).status).toBe(200);
    expect(h.guard).toHaveBeenCalledWith('trip-check-in', 30, 900);
    const [label, messages, run, answer] = h.runTripChange.mock.calls[0];
    expect(label).toBe('Trip check-in');
    expect(messages).toHaveProperty('not_open');
    await run('client');
    expect(h.checkIn).toHaveBeenCalledWith('client', RIDE_ID, USER_ID, expect.any(Date));
    expect(answer({ occupantId: 's1' })).toEqual({ seat: { occupantId: 's1' } });
  });

  it('checks the rate limit, sign-in and the ride ID first', async () => {
    h.guard.mockResolvedValueOnce(Response.json({}, { status: 429 }));
    expect((await POST(request(), ctx())).status).toBe(429);
    expect((await POST(request(), ctx('nope'))).status).toBe(404);
    h.getCurrentUser.mockResolvedValue(null);
    expect((await POST(request(), ctx())).status).toBe(401);
    expect(h.runTripChange).not.toHaveBeenCalled();
  });
});
