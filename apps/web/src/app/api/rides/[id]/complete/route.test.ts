// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  runTripChange: vi.fn(),
  changeTripState: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/trip', () => ({ changeTripState: h.changeTripState }));
vi.mock('@/lib/trip-api', () => ({ runTripChange: h.runTripChange }));

import { POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

function call(id = RIDE_ID) {
  return POST(new Request(`http://localhost/api/rides/${id}/complete`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/rides/[id]/complete'>);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.runTripChange.mockResolvedValue(Response.json({ ride: {} }));
});

describe('POST /api/rides/[id]/complete (FR-RO-09.4)', () => {
  it('passes on the answer of the origin check and rate limit', async () => {
    h.guard.mockResolvedValue(Response.json({ error: 'Too many attempts.' }, { status: 429 }));
    expect((await call()).status).toBe(429);
    expect(h.guard).toHaveBeenCalledWith('complete-ride', 30, 900);
    expect(h.runTripChange).not.toHaveBeenCalled();
  });

  it('requires sign-in, and answers 404 for an ID that is not a UUID', async () => {
    expect((await call('not-a-ride')).status).toBe(404);
    h.getCurrentUser.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Authentication required.',
      code: 'unauthenticated',
    });
    expect(h.runTripChange).not.toHaveBeenCalled();
  });

  it('is the trip step to Completed, with when rating closes, 72 hours later (P-16)', async () => {
    expect((await call()).status).toBe(200);
    const [label, messages, run, answer] = h.runTripChange.mock.calls[0];
    expect(label).toBe('Complete ride');
    expect(messages).toHaveProperty('not_started');
    await run('client');
    expect(h.changeTripState).toHaveBeenCalledWith(
      'client',
      RIDE_ID,
      USER_ID,
      'completed',
      expect.any(Date),
    );
    expect(
      answer({ id: RIDE_ID, state: 'completed', completedAt: '2026-10-10T02:35:00.000Z' }),
    ).toEqual({
      ride: {
        id: RIDE_ID,
        state: 'completed',
        completedAt: '2026-10-10T02:35:00.000Z',
        ratingClosesAt: '2026-10-13T02:35:00.000Z',
      },
    });
    expect(
      answer({ id: RIDE_ID, state: 'in_transit', completedAt: null }).ride.ratingClosesAt,
    ).toBeNull();
  });
});
