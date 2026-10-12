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
  cancelRideForOwner: vi.fn(),
  editRideForOwner: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: h.json,
}));
vi.mock('@/lib/db', () => ({ pool: { connect: h.connect } }));
vi.mock('@/lib/join-requests', () => ({
  cancelRideForOwner: h.cancelRideForOwner,
  editRideForOwner: h.editRideForOwner,
}));

import { PATCH } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

function call(body: unknown = { action: 'edit' }, id = RIDE_ID) {
  h.readJson.mockReset();
  h.readJson.mockResolvedValue(body);
  return PATCH(new Request('http://localhost', { method: 'PATCH' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/rides/[id]'>);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.readJson.mockResolvedValue({ action: 'edit' });
  h.connect.mockResolvedValue({ query: h.clientQuery, release: h.release });
  h.clientQuery.mockResolvedValue({ rows: [] });
  h.cancelRideForOwner.mockResolvedValue({ kind: 'cancelled' });
  h.editRideForOwner.mockResolvedValue({ kind: 'edited' });
});

describe('PATCH /api/rides/[id]', () => {
  it('honors rate limits and authentication before validating ride IDs', async () => {
    h.guard.mockResolvedValueOnce(Response.json({ error: 'Slow down.' }, { status: 429 }));
    expect((await call()).status).toBe(429);
    h.getCurrentUser.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(401);
    expect((await call({ action: 'cancel' }, 'bad')).status).toBe(404);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it.each([
    [{ action: 'other' }, 'invalid_action'],
    [{ action: 'edit', departureStart: 'invalid' }, 'invalid_departure'],
    [{ action: 'edit', capacity: 1.5 }, 'invalid_capacity'],
    [{ action: 'edit', capacity: 0 }, 'invalid_capacity'],
    [{ action: 'edit', expectedTotalFare: 50_001 }, 'invalid_fare'],
    [{ action: 'edit', expectedTotalFare: 2.5 }, 'invalid_fare'],
    [{ action: 'edit', direction: 'sideways' }, 'invalid_direction'],
    [{ action: 'edit', hubId: 5 }, 'invalid_destination'],
    [{ action: 'edit', confirmAffectedRiders: 'yes' }, 'invalid_confirmation'],
  ])('rejects invalid body %o before opening a transaction', async (body, code) => {
    const response = await call(body);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe(code);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('parses valid optional edits, uses the confirmation flag, and commits the edit', async () => {
    const start = '2026-10-10T01:00:00.000Z';
    const response = await call({
      action: 'edit',
      departureStart: start,
      departureEnd: '2026-10-10T02:00:00.000Z',
      capacity: 4,
      expectedTotalFare: 500,
      direction: 'from_hub',
      hubId: 'kanpur-central',
      confirmAffectedRiders: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ride: { id: RIDE_ID } });
    expect(h.editRideForOwner).toHaveBeenCalledWith(
      expect.anything(),
      RIDE_ID,
      USER_ID,
      {
        departureStart: new Date(start),
        departureEnd: new Date('2026-10-10T02:00:00.000Z'),
        capacity: 4,
        expectedTotalFare: 500,
        direction: 'from_hub',
        hubId: 'kanpur-central',
      },
      true,
      expect.any(Date),
    );
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
  });

  it('cancels rides and maps edit and cancel refusals to client errors', async () => {
    expect((await call({ action: 'cancel' })).status).toBe(200);
    expect(h.cancelRideForOwner).toHaveBeenCalledOnce();

    h.editRideForOwner.mockResolvedValueOnce({ kind: 'confirmation_required', detail: 'Confirm.' });
    const refused = await call({ action: 'edit' });
    expect(refused.status).toBe(409);
    expect((await refused.json()).error).toBe('Confirm.');
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN', 'COMMIT', 'BEGIN', 'ROLLBACK',
    ]);
  });

  it('returns server errors and rolls back a failed transaction', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.editRideForOwner.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('server_error');
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(h.release).toHaveBeenCalledOnce();
    quiet.mockRestore();
  });
});
