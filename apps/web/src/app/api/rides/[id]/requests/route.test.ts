
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  guard: vi.fn(),
  readJson: vi.fn(),
  getActiveSuspension: vi.fn(),
  estimateShare: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
  guard: mocks.guard,
  readJson: mocks.readJson,
  json: (body: unknown, status = 200) =>
    Response.json(body, { status }),
}));

vi.mock('@/lib/db', () => ({
  pool: {
    connect: mocks.connect,
    query: mocks.query,
  },
}));

vi.mock('@/lib/suspensions', () => ({
  getActiveSuspension: mocks.getActiveSuspension,
}));

vi.mock('@/lib/enforcement-rules', () => ({
  suspendedMessage: vi.fn(() => 'Account suspended.'),
}));

vi.mock('@/lib/fare', () => ({
  estimateShare: mocks.estimateShare,
}));

import { POST } from './route';

const rideId = '734057ef-0581-4a2e-8527-843e226ef0eb';
const riderId = '12345678-1234-4123-8123-123456789abc';
const requestId = '87654321-4321-4321-8321-cba987654321';
const idempotencyKey = 'abcdefab-cdef-4abc-8def-abcdefabcdef';

type DatabaseScenario = {
  emailVerified?: boolean;
  rideExists?: boolean;
  ownerIsRider?: boolean;
  rideState?: string;
  departure?: Date;
  pickupValid?: boolean;
  occupants?: number;
  capacity?: number;
  duplicateRequest?: boolean;
  activeRequests?: number;
  acceptedRideConflict?: boolean;
};

function makeRequest(body: unknown) {
  return new Request(
    `http://localhost:3000/api/rides/${rideId}/requests`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

function makeContext(id = rideId) {
  return { params: Promise.resolve({ id }) };
}

function setupValidUser() {
  mocks.guard.mockResolvedValue(null);
  mocks.getCurrentUser.mockResolvedValue({ id: riderId });
  mocks.getActiveSuspension.mockResolvedValue(null);
  mocks.estimateShare.mockReturnValue(500);
  mocks.readJson.mockImplementation((req: Request) => req.json());
}

function setupDatabase(scenario: DatabaseScenario = {}) {
  const departure =
    scenario.departure ?? new Date(Date.now() + 3 * 60 * 60 * 1000);

  const requestRow = {
    id: requestId,
    ride_id: rideId,
    rider_id: riderId,
    pickup_point_id: 'hall-1',
    status: 'pending',
    departure_snapshot: departure,
    pickup_time_snapshot: departure,
    estimated_share_snapshot: 500,
    submitted_at: new Date(),
  };

  mocks.connect.mockResolvedValue({
    query: mocks.clientQuery,
    release: mocks.release,
  });

  mocks.clientQuery.mockImplementation(async (sql: string) => {
    const query = String(sql);

    if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
      return { rows: [] };
    }

    if (query.includes('FROM users')) {
      return {
        rows: [
          {
            id: riderId,
            email_verified_at:
              scenario.emailVerified === false ? null : new Date(),
          },
        ],
      };
    }

    if (
      query.includes('FROM ride_join_requests') &&
      query.includes('idempotency_key')
    ) {
      return { rows: [] };
    }

    if (query.includes('FROM rides')) {
      return {
        rows:
          scenario.rideExists === false
            ? []
            : [
                {
                  id: rideId,
                  owner_id: scenario.ownerIsRider
                    ? riderId
                    : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  departure_start: departure,
                  expected_total_fare: 2000,
                  capacity_snapshot: scenario.capacity ?? 4,
                  state: scenario.rideState ?? 'scheduled',
                },
              ],
      };
    }

    if (query.includes('FROM locations')) {
      return {
        rows:
          scenario.pickupValid === false
            ? []
            : [{ id: 'hall-1', type: 'campus' }],
      };
    }

    if (
      query.includes('FROM riders AS confirmed')
    ) {
      return {
        rows: scenario.acceptedRideConflict
          ? [{ id: 'another-ride-id' }]
          : [],
      };
    }

    if (
      query.includes('FROM riders') &&
      query.includes('COUNT(*)')
    ) {
      return {
        rows: [{ count: String(scenario.occupants ?? 1) }],
      };
    }

    if (
      query.includes('FROM ride_join_requests') &&
      query.includes("status IN ('pending', 'needs_reconfirmation', 'accepted')")
    ) {
      return {
        rows: scenario.duplicateRequest ? [{ id: requestId }] : [],
      };
    }

    if (
      query.includes('FROM ride_join_requests') &&
      query.includes('COUNT(*)')
    ) {
      return {
        rows: [{ count: String(scenario.activeRequests ?? 0) }],
      };
    }

    if (query.includes('INSERT INTO ride_join_requests')) {
      return { rows: [requestRow] };
    }

    return { rows: [] };
  });
}

describe('POST /api/rides/[id]/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupValidUser();

    mocks.connect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.release,
    });

    mocks.clientQuery.mockResolvedValue({ rows: [] });
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(401);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects an invalid ride ID', async () => {
    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext('not-a-uuid'),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_ride_id');
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects a missing pickup point', async () => {
    const response = await POST(
      makeRequest({ idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects an invalid idempotency key', async () => {
    const response = await POST(
      makeRequest({
        pickupPointId: 'hall-1',
        idempotencyKey: 'invalid',
      }),
      makeContext(),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects a rider whose email is not verified', async () => {
    setupDatabase({ emailVerified: false });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('email_not_verified');
    expect(mocks.clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.release).toHaveBeenCalled();
  });

  it('rejects a suspended rider', async () => {
    setupDatabase();
    mocks.getActiveSuspension.mockResolvedValue({ id: 'suspension-1' });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('suspended');
    expect(mocks.clientQuery).toHaveBeenCalledWith('ROLLBACK');
  });

  it('returns 404 when the ride does not exist', async () => {
    setupDatabase({ rideExists: false });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('ride_not_found');
    expect(mocks.clientQuery).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rejects a ride that is no longer open', async () => {
    setupDatabase({ rideState: 'cancelled' });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ride_not_open');
  });

  it('prevents the ride owner from joining their own ride', async () => {
    setupDatabase({ ownerIsRider: true });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ride_owner_cannot_join');
  });

  it('rejects requests after the departure deadline', async () => {
    setupDatabase({
      departure: new Date(Date.now() + 30 * 60 * 1000),
    });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('request_deadline_passed');
  });

  it('rejects an invalid pickup point', async () => {
    setupDatabase({ pickupValid: false });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_pickup_point');
  });

  it('rejects a ride with no available seats', async () => {
    setupDatabase({ occupants: 4, capacity: 4 });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ride_full');
  });

  it('rejects a duplicate active request for the same ride', async () => {
    setupDatabase({ duplicateRequest: true });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('duplicate_active_request');
  });

  it('rejects a rider who already has three active requests', async () => {
    setupDatabase({ activeRequests: 3 });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe(
      'active_request_limit_reached',
    );
  });

  it('rejects a ride that conflicts with another accepted ride', async () => {
    setupDatabase({ acceptedRideConflict: true });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe(
      'accepted_ride_time_conflict',
    );
  });

  it('creates a pending join request', async () => {
    setupDatabase();

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.reused).toBe(false);
    expect(body.request.status).toBe('pending');
    expect(body.request.rideId).toBe(rideId);
    expect(body.request.pickupPointId).toBe('hall-1');

    expect(mocks.clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mocks.release).toHaveBeenCalled();
  });

  it('reuses an existing request with the same idempotency key', async () => {
    setupDatabase();

    const previousRequest = {
      id: requestId,
      ride_id: rideId,
      rider_id: riderId,
      pickup_point_id: 'hall-1',
      status: 'pending',
      departure_snapshot: new Date(Date.now() + 3 * 60 * 60 * 1000),
      pickup_time_snapshot: new Date(Date.now() + 3 * 60 * 60 * 1000),
      estimated_share_snapshot: 500,
      submitted_at: new Date(),
    };

    mocks.clientQuery.mockImplementation(async (sql: string) => {
      const query = String(sql);

      if (query.includes('FROM users')) {
        return {
          rows: [{ id: riderId, email_verified_at: new Date() }],
        };
      }

      if (
        query.includes('FROM ride_join_requests') &&
        query.includes('idempotency_key')
      ) {
        return { rows: [previousRequest] };
      }

      return { rows: [] };
    });

    const response = await POST(
      makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
      makeContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reused).toBe(true);
    expect(body.request.id).toBe(requestId);
    expect(body.request.status).toBe('pending');

    expect(mocks.clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ride_join_requests'),
      expect.anything(),
    );
  });

  it('returns 500 when the database connection fails', async () => {
    mocks.connect.mockRejectedValue(new Error('Database unavailable'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await POST(
        makeRequest({ pickupPointId: 'hall-1', idempotencyKey }),
        makeContext(),
      );

      expect(response.status).toBe(500);
      expect((await response.json()).code).toBe('join_request_failed');
    } finally {
      consoleError.mockRestore();
    }
  });
});
