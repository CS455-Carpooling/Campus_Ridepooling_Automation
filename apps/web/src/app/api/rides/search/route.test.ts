// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  searchRides: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  json: h.json,
}));

vi.mock('@/lib/ride-search', () => ({
  searchRides: h.searchRides,
}));

import { GET } from './route';

describe('GET /api/rides/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.guard.mockResolvedValue(null);
    h.getCurrentUser.mockResolvedValue({ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' });
    h.searchRides.mockResolvedValue([]);
  });

  it('rejects unauthenticated requests with 401', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    const req = new Request('http://localhost:3000/api/rides/search');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('validates missing required query params with 400', async () => {
    const req = new Request('http://localhost:3000/api/rides/search');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; errors: Record<string, string> };
    expect(body.error).toBe('Validation failed.');
    expect(body.errors).toHaveProperty('direction');
    expect(body.errors).toHaveProperty('hubId');
    expect(body.errors).toHaveProperty('campusLocationId');
  });

  it('returns matching rides when query params are valid', async () => {
    const mockRides = [{ id: 'ride-1', totalFare: 400 }];
    h.searchRides.mockResolvedValue(mockRides);

    const url =
      'http://localhost:3000/api/rides/search?direction=to_hub&hubId=kanpur-central&campusLocationId=hall-6&departureStart=2099-10-10T06:30:00%2B05:30&departureEnd=2099-10-10T07:30:00%2B05:30';
    const req = new Request(url);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { rides: unknown[] };
    expect(body.rides).toEqual(mockRides);
  });
});
