// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  getRideFormOptions: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: m.guard,
  getCurrentUser: m.getCurrentUser,
  json: (body: object, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/ride-options', () => ({ getRideFormOptions: m.getRideFormOptions }));

import { GET } from './route';

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.guard.mockResolvedValue(null);
  m.getCurrentUser.mockResolvedValue({ id: 'u1' });
});

describe('GET /api/rides/options', () => {
  it('returns the guard response when blocked', async () => {
    m.guard.mockResolvedValue(new Response('blocked', { status: 429 }));
    expect((await GET()).status).toBe(429);
    expect(m.getCurrentUser).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    m.getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(m.getRideFormOptions).not.toHaveBeenCalled();
  });

  it('returns database-backed form options', async () => {
    const options = {
      campusPlaces: [{ id: 'hall-1', name: 'Hall 1' }],
      hubs: [{ id: 'kanpur-central', name: 'Kanpur Central' }],
      vehicleTypes: [{ id: 'car', name: 'Car', capacity: 4 }],
    };
    m.getRideFormOptions.mockResolvedValue(options);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(options);
  });

  it('returns a generic server error when options cannot be loaded', async () => {
    m.getRideFormOptions.mockRejectedValue(new Error('db failed'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to load ride options right now.' });
  });
});
