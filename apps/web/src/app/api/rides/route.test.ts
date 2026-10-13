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
  getActiveSuspension: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: h.json,
}));
vi.mock('@/lib/db', () => ({
  pool: { connect: h.connect },
}));
vi.mock('@/lib/suspensions', () => ({ getActiveSuspension: h.getActiveSuspension }));

import { POST } from './route';

const validBody = {
  direction: 'to_hub',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-6',
  vehicleTypeId: 'car',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
  expectedTotalFare: 460,
};

const locations = [
  { id: 'kanpur-central', type: 'transport_hub' },
  { id: 'hall-6', type: 'campus' },
];
const vehicles = [{ id: 'car', capacity: 4 }];

function client() {
  return { query: h.clientQuery, release: h.release };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  h.getActiveSuspension.mockResolvedValue(null);
  h.readJson.mockResolvedValue({ ...validBody });
  h.connect.mockResolvedValue(client());
  h.clientQuery.mockImplementation((sql: string) => {
    if (sql.includes('FROM locations')) return Promise.resolve({ rows: locations });
    if (sql.includes('FROM vehicle_types')) return Promise.resolve({ rows: vehicles });
    if (sql === 'SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE') {
      return Promise.resolve({ rows: [{ id: 'user-1' }] });
    }
    if (sql.includes('SELECT 1 FROM rides')) return Promise.resolve({ rows: [] });
    if (sql.includes('INSERT INTO rides')) {
      return Promise.resolve({
        rows: [
          {
            id: 'ride-1',
            owner_id: 'user-1',
            direction: 'to_hub',
            hub_id: 'kanpur-central',
            vehicle_type_id: 'car',
            capacity_snapshot: 4,
            departure_start: new Date('2099-10-10T01:00:00.000Z'),
            departure_end: new Date('2099-10-10T02:00:00.000Z'),
            expected_total_fare: 460,
            state: 'scheduled',
            created_at: new Date('2026-10-04T12:00:00.000Z'),
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  });
});

describe('POST /api/rides', () => {
  it('refuses a suspended rider before touching the ride tables (FR-RD-01.5, CS455-52)', async () => {
    h.getActiveSuspension.mockResolvedValue({
      id: 's1',
      reasonCategory: 'safety',
      startsAt: '2026-10-11T00:00:00.000Z',
      endsAt: '2026-10-14T00:00:00.000Z',
      isIndefinite: false,
    });
    const res = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe('suspended');
    expect(body.error).toMatch(/suspended until .* \(reason: Safety\), so you cannot offer a ride/);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required.' });
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('returns 500 when a database connection cannot be acquired', async () => {
    h.connect.mockRejectedValueOnce(new Error('connection failure'));
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to create the ride right now.' });
  });

  it('validates the request using active database-backed options', async () => {
    h.readJson.mockResolvedValue({ ...validBody, vehicleTypeId: 'missing' });
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(400);
    expect((await response.json()).errors.vehicleTypeId).toBeTruthy();
    expect(h.connect).toHaveBeenCalled();
    expect(h.clientQuery).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rejects a location with the wrong category', async () => {
    h.readJson.mockResolvedValue({ ...validBody, hubId: 'hall-6' });
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(400);
    expect((await response.json()).errors.hubId).toBe('Choose an active transport hub.');
    expect(h.clientQuery).toHaveBeenCalledWith('ROLLBACK');
  });

  it('uses database capacity and creates the owner rider in one transaction', async () => {
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ride.capacity).toBe(4);
    expect(h.clientQuery).toHaveBeenCalledWith('BEGIN');
    expect(h.clientQuery.mock.calls.some(([sql]) => String(sql).includes('FOR SHARE'))).toBe(true);
    expect(h.clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(
      h.clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO riders')),
    ).toBe(true);
    const rideInsert = h.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO rides'),
    );
    expect(rideInsert?.[1][4]).toBe(4);
    // The owner's own requests still waiting near this departure are withdrawn (P-08).
    const withdraw = h.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("request.status IN ('pending', 'needs_reconfirmation')"),
    );
    expect(withdraw?.[1]).toEqual(['user-1', null, new Date(validBody.departureStart), 7200]);
  });

  it('rejects overlapping active rides', async () => {
    h.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM locations')) return Promise.resolve({ rows: locations });
      if (sql.includes('FROM vehicle_types')) return Promise.resolve({ rows: vehicles });
      if (sql === 'SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE') {
        return Promise.resolve({ rows: [{ id: 'user-1' }] });
      }
      if (sql.includes('SELECT 1 FROM rides')) {
        return Promise.resolve({ rows: [{ '?column?': 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'You already have a scheduled or active ride that overlaps this departure window.',
    });
    expect(h.clientQuery).toHaveBeenCalledWith('ROLLBACK');
  });

  it('refuses a ride departing within two hours of a seat held on another ride (P-08)', async () => {
    h.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM locations')) return Promise.resolve({ rows: locations });
      if (sql.includes('FROM vehicle_types')) return Promise.resolve({ rows: vehicles });
      if (sql === 'SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE') {
        return Promise.resolve({ rows: [{ id: 'user-1' }] });
      }
      if (sql.includes('SELECT 1 FROM riders seat')) {
        return Promise.resolve({ rows: [{ '?column?': 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'You already have a ride, offered or joined, departing within two hours of this one.',
      code: 'departure_conflict',
    });
    // The same rule as joining a ride (travelConflict): no-shows and seats left do not count.
    const seatCheck = h.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT 1 FROM riders seat'),
    );
    expect(seatCheck?.[0]).toContain('seat.left_at IS NULL AND seat.no_show_at IS NULL');
    expect(seatCheck?.[1]).toEqual(['user-1', null, validBody.departureStart, 7200]);
    expect(h.clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(
      h.clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO rides')),
    ).toBe(false);
  });

  it('rolls back and returns 500 when persistence fails', async () => {
    h.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM locations')) return Promise.resolve({ rows: locations });
      if (sql.includes('FROM vehicle_types')) return Promise.resolve({ rows: vehicles });
      if (sql === 'SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE') {
        return Promise.resolve({ rows: [{ id: 'user-1' }] });
      }
      if (sql.includes('SELECT 1 FROM rides')) return Promise.resolve({ rows: [] });
      if (sql.includes('INSERT INTO rides')) return Promise.reject(new Error('db failure'));
      return Promise.resolve({ rows: [] });
    });
    const response = await POST(new Request('http://localhost/api/rides', { method: 'POST' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to create the ride right now.' });
    expect(h.clientQuery).toHaveBeenCalledWith('ROLLBACK');
  });
});
