// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  query: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  submitJoinRequest: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: h.json,
}));
vi.mock('@/lib/db', () => ({ pool: { query: h.query, connect: h.connect } }));
vi.mock('@/lib/join-requests', () => ({ submitJoinRequest: h.submitJoinRequest }));

import { GET, POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';
const REQUEST_ID = '8b3c4d5e-4444-4000-8000-000000000004';
const at = new Date('2026-10-10T01:00:00.000Z');
const snapshot = {
  snapshot_departure_start: at,
  snapshot_pickup_at: at,
  snapshot_estimated_share: 200,
};

function context(id = RIDE_ID) {
  return { params: Promise.resolve({ id }) } as RouteContext<'/api/rides/[id]/requests'>;
}

function request(body?: unknown) {
  return new Request(`http://localhost/api/rides/${RIDE_ID}/requests`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.readJson.mockResolvedValue({
    pickupLocationId: ' hall-3 ',
    idempotencyKey: ' retry-key ',
  });
  h.query.mockResolvedValue({ rows: [] });
  h.clientQuery.mockResolvedValue({ rows: [] });
  h.connect.mockResolvedValue({ query: h.clientQuery, release: h.release });
});

afterEach(() => vi.useRealTimers());

describe('GET /api/rides/[id]/requests', () => {
  it('requires sign-in and validates the ride ID before querying', async () => {
    h.getCurrentUser.mockResolvedValueOnce(null);
    expect((await GET(new Request('http://localhost'), context())).status).toBe(401);
    expect((await GET(new Request('http://localhost'), context('bad-id'))).status).toBe(404);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('answers not-found for rides that do not exist', async () => {
    const response = await GET(new Request('http://localhost'), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'not_found' });
    expect(h.query).toHaveBeenCalledOnce();
  });

  it('returns owner requests with the submitted snapshot as fallback for current terms', async () => {
    h.query.mockResolvedValueOnce({ rows: [{ owner_id: USER_ID }] }).mockResolvedValueOnce({
      rows: [
        {
          id: REQUEST_ID,
          status: 'pending',
          reason_code: null,
          submitted_at: at,
          ...snapshot,
          current_departure_start: null,
          current_pickup_at: null,
          current_estimated_share: null,
          rider_name: 'Rider',
          pickup_name: 'Hall 3',
          visible_tags: null,
        },
      ],
    });

    const response = await GET(new Request('http://localhost'), context());
    expect(await response.json()).toMatchObject({
      role: 'owner',
      requests: [
        {
          id: REQUEST_ID,
          riderName: 'Rider',
          visibleTags: [],
          agreed: { estimatedShare: 200 },
          current: {
            departureStart: at.toISOString(),
            pickupAt: at.toISOString(),
            estimatedShare: 200,
          },
        },
      ],
    });
    expect(h.query).toHaveBeenCalledTimes(2);
  });

  it('returns a rider’s request history, including null accepted time and changed terms', async () => {
    h.query
      .mockResolvedValueOnce({ rows: [{ owner_id: 'another-owner' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: REQUEST_ID,
            status: 'needs_reconfirmation',
            reason_code: 'changed_terms',
            submitted_at: at,
            accepted_at: null,
            ...snapshot,
            current_departure_start: new Date(at.getTime() + 60_000),
            current_pickup_at: new Date(at.getTime() + 120_000),
            current_estimated_share: 250,
            late_cancellation: false,
            locked_share: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            request_id: REQUEST_ID,
            from_status: 'pending',
            to_status: 'needs_reconfirmation',
            reason_code: 'changed_terms',
            details: {},
            created_at: at,
          },
        ],
      });

    const response = await GET(new Request('http://localhost'), context());
    expect(await response.json()).toMatchObject({
      role: 'rider',
      requests: [
        {
          acceptedAt: null,
          current: { estimatedShare: 250 },
          history: [{ from: 'pending', to: 'needs_reconfirmation', at: at.toISOString() }],
        },
      ],
    });
    expect(h.query).toHaveBeenCalledTimes(3);
  });
});

describe('POST /api/rides/[id]/requests', () => {
  it('returns rate-limit and authentication responses without opening a transaction', async () => {
    h.guard.mockResolvedValueOnce(Response.json({ error: 'Slow down.' }, { status: 429 }));
    expect((await POST(request(), context())).status).toBe(429);
    h.getCurrentUser.mockResolvedValueOnce(null);
    expect((await POST(request(), context())).status).toBe(401);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('rejects invalid ride IDs and invalid request bodies before connecting', async () => {
    expect((await POST(request(), context('bad-id'))).status).toBe(404);
    h.readJson.mockResolvedValueOnce({ pickupLocationId: '', idempotencyKey: '' });
    const response = await POST(request(), context());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('commits a newly created request and returns 201', async () => {
    h.submitJoinRequest.mockResolvedValue({
      kind: 'created',
      request: { id: REQUEST_ID },
      idempotent: false,
    });
    const response = await POST(request(), context());
    expect(response.status).toBe(201);
    expect(h.submitJoinRequest).toHaveBeenCalledWith(
      expect.anything(),
      RIDE_ID,
      USER_ID,
      'hall-3',
      'retry-key',
      expect.any(Date),
    );
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('returns existing requests as success and rolls back refusals other than a lock transition', async () => {
    h.submitJoinRequest.mockResolvedValueOnce({ kind: 'existing', request: { id: REQUEST_ID } });
    expect((await POST(request(), context())).status).toBe(200);
    h.submitJoinRequest.mockResolvedValueOnce({ kind: 'ride_full' });
    const refused = await POST(request(), context());
    expect(refused.status).toBe(409);
    expect((await refused.json()).code).toBe('ride_full');
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'COMMIT',
      'BEGIN',
      'ROLLBACK',
    ]);
  });

  it('commits a discovered lock transition and reports database failures', async () => {
    h.submitJoinRequest.mockResolvedValueOnce({ kind: 'ride_locked' });
    expect((await POST(request(), context())).status).toBe(409);
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);

    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.submitJoinRequest.mockRejectedValueOnce(new Error('database unavailable'));
    expect((await POST(request(), context())).status).toBe(500);
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'COMMIT',
      'BEGIN',
      'ROLLBACK',
    ]);
    expect(h.release).toHaveBeenCalledTimes(2);
    quiet.mockRestore();
  });
});
