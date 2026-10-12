// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  lockRideForOwner: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ guard: h.guard, getCurrentUser: h.getCurrentUser, json: h.json }));
vi.mock('@/lib/db', () => ({ pool: { connect: h.connect } }));
vi.mock('@/lib/join-requests', () => ({ lockRideForOwner: h.lockRideForOwner }));

import { POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

function call(id = RIDE_ID) {
  return POST(new Request('http://localhost', { method: 'POST' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/rides/[id]/lock'>);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.connect.mockResolvedValue({ query: h.clientQuery, release: h.release });
  h.clientQuery.mockResolvedValue({ rows: [] });
  h.lockRideForOwner.mockResolvedValue({ kind: 'locked' });
});

describe('POST /api/rides/[id]/lock', () => {
  it('honors rate limits, requires authentication, and checks ride IDs', async () => {
    h.guard.mockResolvedValueOnce(Response.json({ error: 'Slow down.' }, { status: 429 }));
    expect((await call()).status).toBe(429);
    h.getCurrentUser.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(401);
    expect((await call('bad')).status).toBe(404);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('locks the ride in a transaction', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rideId: RIDE_ID, locked: true });
    expect(h.lockRideForOwner).toHaveBeenCalledWith(
      expect.anything(),
      RIDE_ID,
      USER_ID,
      expect.any(Date),
    );
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it.each([
    ['not_found', 404],
    ['not_owner', 403],
    ['ride_closed', 409],
    ['ride_locked', 409],
    ['unexpected', 409],
  ])('rolls back and maps %s to %i', async (kind, status) => {
    h.lockRideForOwner.mockResolvedValueOnce({ kind });
    const response = await call();
    expect(response.status).toBe(status);
    expect((await response.json()).code).toBe(kind);
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('returns a server error when lock processing fails', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.lockRideForOwner.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('server_error');
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    quiet.mockRestore();
  });
});
