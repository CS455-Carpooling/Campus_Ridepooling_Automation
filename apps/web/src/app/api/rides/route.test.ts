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