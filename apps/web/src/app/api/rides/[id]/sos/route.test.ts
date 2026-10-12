// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  runTripChange: vi.fn(),
  raiseSos: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/sos', () => ({ raiseSos: h.raiseSos }));
vi.mock('@/lib/trip-api', () => ({ runTripChange: h.runTripChange }));

import { POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

const ctx = (id = RIDE_ID) =>
  ({ params: Promise.resolve({ id }) }) as RouteContext<'/api/rides/[id]/sos'>;
const request = () => new Request(`http://localhost/api/rides/${RIDE_ID}/sos`, { method: 'POST' });

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.runTripChange.mockResolvedValue(Response.json({ incident: {} }, { status: 201 }));
});

describe('POST /api/rides/[id]/sos (FR-RD-15.1, 15.2)', () => {
  it('raises the alert as the signed-in user: 201 when new, 200 when already active', async () => {
    expect((await POST(request(), ctx())).status).toBe(201);
    expect(h.guard).toHaveBeenCalledWith('sos', 20, 3600);
    const [label, messages, run, body, options] = h.runTripChange.mock.calls[0];
    expect(label).toBe('SOS');
    expect(messages.not_active).toContain('112');
    await run('client');
    expect(h.raiseSos).toHaveBeenCalledWith('client', RIDE_ID, USER_ID, expect.any(Date));
    expect(body({ incident: { id: 'i1' }, created: true })).toEqual({ incident: { id: 'i1' } });
    expect(options.status({ created: true })).toBe(201);
    expect(options.status({ created: false })).toBe(200);
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
