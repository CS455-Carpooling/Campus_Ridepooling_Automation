
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

const departure = new Date(Date.now() + 3 * 60 * 60 * 1000);

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
}

function setupDatabase() {
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

  mocks.clientQuery.mockImplementation(async (sql: string) => {
    const query = String(sql);

    if (query.includes('FROM users')) {
      return {
        rows: [{ id: riderId, email_verified_at: new Date() }],
      };
    }

    if (query.includes('FROM ride_join_requests')) {
      if (query.includes('idempotency_key')) {
        return { rows: [] };
      }

      if (query.includes('COUNT(*)')) {
        return { rows: [{ count: '0' }] };
      }

      return { rows: [] };
    }

    if (query.includes('FROM rides')) {
      return {
        rows: [
          {
            id: rideId,
            owner_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            departure_start: departure,
            expected_total_fare: 2000,
            capacity_snapshot: 4,
            state: 'scheduled',
          },
        ],
      };
    }

    if (query.includes('FROM locations')) {
      return { rows: [{ id: 'hall-1', type: 'campus' }] };
    }

    if (query.includes('FROM riders')) {
      if (query.includes('COUNT(*)')) {
        return { rows: [{ count: '1' }] };
      }

      return { rows: [] };
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

    mocks.readJson.mockImplementation((req: Request) => req.json());

    mocks.connect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.release,
    });
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(
      makeRequest({
        pickupPointId: 'hall-1',
        idempotencyKey,
      }),
      makeContext(),
    );

    expect(response.status).toBe(401);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects an invalid ride ID', async () => {
    const response = await POST(
      makeRequest({
        pickupPointId: 'hall-1',
        idempotencyKey,
      }),
      makeContext('not-a-uuid'),
    );

    expect(response.status).toBe(400);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects a missing pickup point', async () => {
    const response = await POST(
      makeRequest({ idempotencyKey }),
      makeContext(),
    );

    expect(response.status).toBe(400);
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
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('creates a pending join request', async () => {
    setupDatabase();

    const response = await POST(
      makeRequest({
        pickupPointId: 'hall-1',
        idempotencyKey,
      }),
      makeContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.reused).toBe(false);
    expect(body.request.status).toBe('pending');
    expect(body.request.rideId).toBe(rideId);
    expect(body.request.pickupPointId).toBe('hall-1');

    expect(mocks.clientQuery).toHaveBeenCalledWith(
      'COMMIT',
    );
    expect(mocks.release).toHaveBeenCalled();
  });

  it('reuses an existing request with the same idempotency key', async () => {
    setupDatabase();

    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM users')) {
        return {
          rows: [
            { id: riderId, email_verified_at: new Date() },
          ],
        };
      }

      if (
        String(sql).includes('FROM ride_join_requests') &&
        String(sql).includes('idempotency_key')
      ) {
        return {
          rows: [
            {
              id: requestId,
              ride_id: rideId,
              rider_id: riderId,
              pickup_point_id: 'hall-1',
              status: 'pending',
              departure_snapshot: departure,
              pickup_time_snapshot: departure,
              estimated_share_snapshot: 500,
              submitted_at: new Date(),
            },
          ],
        };
      }

      return { rows: [] };
    });

    const response = await POST(
      makeRequest({
        pickupPointId: 'hall-1',
        idempotencyKey,
      }),
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
});
