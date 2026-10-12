import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.mock('./db', () => ({ pool: { query: db.query, connect: db.connect } }));

import {
  actOnJoinRequest,
  cancelRideForOwner,
  editRideForOwner,
  expireDueJoinRequests,
  lockRideForOwner,
  submitJoinRequest,
} from './join-requests';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const OWNER_ID = '6f1c2a5e-2222-4000-8000-000000000002';
const RIDER_ID = '7a2b3c4d-3333-4000-8000-000000000003';
const REQUEST_ID = '8b3c4d5e-4444-4000-8000-000000000004';
const NOW = new Date('2026-10-09T12:00:00.000Z');
const DEPARTURE = new Date('2026-10-10T01:00:00.000Z');

const ride = {
  id: RIDE_ID,
  owner_id: OWNER_ID,
  direction: 'to_hub' as const,
  state: 'scheduled' as const,
  departure_start: DEPARTURE,
  departure_end: new Date('2026-10-10T02:00:00.000Z'),
  expected_total_fare: 400,
  capacity_snapshot: 3,
  locked_at: null,
};

const ownerSeat = { user_id: OWNER_ID, campus_location_id: 'hall-1', locked_share: null };
const riderSeat = { user_id: RIDER_ID, campus_location_id: 'hall-3', locked_share: null };

function makeClient(handler: (sql: string, values?: unknown[]) => unknown[]) {
  const query = vi.fn(async (sql: string, values?: unknown[]) => ({
    rows: handler(sql, values),
  }));
  return { client: { query } as unknown as PoolClient, query };
}

function requestRow(status: 'pending' | 'accepted' = 'pending') {
  return {
    id: REQUEST_ID,
    ride_id: RIDE_ID,
    rider_id: RIDER_ID,
    status,
    reason_code: null,
    pickup_location_id: 'hall-3',
    submitted_at: NOW,
    snapshot_departure_start: DEPARTURE,
    snapshot_pickup_at: new Date(DEPARTURE.getTime() + 5 * 60_000),
    snapshot_estimated_share: 200,
    accepted_departure_start: status === 'accepted' ? DEPARTURE : null,
    accepted_pickup_at: status === 'accepted' ? new Date(DEPARTURE.getTime() + 5 * 60_000) : null,
    locked_share: null,
    no_liability_until_trip: false,
  };
}

function makeActionClient({
  status = 'pending',
  lockedAt = null,
  noLiability = false,
}: {
  status?: 'pending' | 'needs_reconfirmation' | 'accepted';
  lockedAt?: Date | null;
  noLiability?: boolean;
} = {}) {
  let seatRead = 0;
  const actionRide = { ...ride, locked_at: lockedAt };
  const row = {
    ...requestRow(status === 'accepted' ? 'accepted' : 'pending'),
    status,
    no_liability_until_trip: noLiability,
    locked_share: lockedAt ? 200 : null,
  };
  return makeClient((sql) => {
    if (sql.includes('SELECT rider_id FROM ride_join_requests WHERE id = $1 AND ride_id = $2')) {
      return [{ rider_id: RIDER_ID }];
    }
    if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
    if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [actionRide];
    if (sql.includes('FROM ride_join_requests WHERE id = $1 AND ride_id = $2 FOR NO KEY UPDATE')) {
      return [row];
    }
    if (sql.includes("WHERE ride_id = $1 AND status IN ('pending', 'needs_reconfirmation')")) {
      return status === 'pending' || status === 'needs_reconfirmation' ? [row] : [];
    }
    if (sql.includes('FROM rider_suspensions')) return [];
    if (sql.includes('SELECT user_id, campus_location_id, locked_share')) {
      seatRead += 1;
      return seatRead === 1
        ? [ownerSeat, ...(status === 'accepted' ? [riderSeat] : [])]
        : [ownerSeat];
    }
    if (sql.includes('SELECT id, name FROM locations')) {
      return [
        { id: 'hall-1', name: 'Hall 1' },
        { id: 'hall-3', name: 'Hall 3' },
      ];
    }
    if (sql.includes('abs(extract(epoch')) return [];
    if (sql.includes('SELECT request.id, request.ride_id, ride.owner_id')) return [];
    if (sql.includes("WHERE ride_id = $1 AND status = 'accepted'")) return [];
    return [];
  });
}

beforeEach(() => {
  db.query.mockReset();
  db.connect.mockReset();
});

describe('expireDueJoinRequests', () => {
  it('queries scheduled rides using the current timestamp plus the lock window', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expireDueJoinRequests(NOW);

    expect(db.query).toHaveBeenCalledOnce();
    expect(db.query.mock.calls[0][0]).toContain(
      "departure_start <= $1::timestamptz + interval '60 minutes'",
    );
    expect(db.query.mock.calls[0][1]).toEqual([NOW]);
  });
});

describe('submitJoinRequest', () => {
  it('creates an idempotent pending request, event, and owner notification in the transaction', async () => {
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) return [];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('FROM rider_suspensions')) return [];
      if (sql.includes("type = 'campus'")) return [{ id: 'hall-3' }];
      if (sql.includes('WHERE ride_id = $1 AND rider_id = $2')) return [];
      if (sql.includes('count(*)::int AS count')) return [{ count: 0 }];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share')) return [ownerSeat];
      if (sql.includes('abs(extract(epoch')) return [];
      if (sql.includes('SELECT id, name FROM locations')) {
        return [
          { id: 'hall-1', name: 'Hall 1' },
          { id: 'hall-3', name: 'Hall 3' },
        ];
      }
      if (sql.includes('INSERT INTO ride_join_requests')) return [{ id: REQUEST_ID }];
      return [];
    });

    await expect(
      submitJoinRequest(client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-1', NOW),
    ).resolves.toEqual({
      kind: 'created',
      requestId: REQUEST_ID,
      state: 'pending',
      idempotent: false,
    });
    expect(
      query.mock.calls.some(([sql]) => sql.includes('INSERT INTO ride_join_request_events')),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) => sql.includes('INSERT INTO ride_join_request_keys')),
    ).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO notifications'))).toBe(true);
  });

  it('returns the original request for a still-valid idempotency key', async () => {
    const { client } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) {
        return [{ id: REQUEST_ID, status: 'needs_reconfirmation' }];
      }
      return [];
    });

    await expect(
      submitJoinRequest(client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-1', NOW),
    ).resolves.toEqual({
      kind: 'existing',
      requestId: REQUEST_ID,
      state: 'needs_reconfirmation',
      idempotent: true,
    });
  });

  it('refuses a full ride without creating a request', async () => {
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) return [];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('FROM rider_suspensions')) return [];
      if (sql.includes("type = 'campus'")) return [{ id: 'hall-3' }];
      if (sql.includes('WHERE ride_id = $1 AND rider_id = $2')) return [];
      if (sql.includes('count(*)::int AS count')) return [{ count: 0 }];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share')) {
        return [
          ownerSeat,
          riderSeat,
          { user_id: '9c4d5e6f-5555-4000-8000-000000000005', campus_location_id: 'hall-4' },
        ];
      }
      return [];
    });

    await expect(
      submitJoinRequest(client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-2', NOW),
    ).resolves.toMatchObject({ kind: 'ride_full' });
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO ride_join_requests'))).toBe(
      false,
    );
  });

  it('prevents a rider from exceeding the waiting-request limit or duplicating a request', async () => {
    const active = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) return [];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('FROM rider_suspensions')) return [];
      if (sql.includes("type = 'campus'")) return [{ id: 'hall-3' }];
      if (sql.includes('WHERE ride_id = $1 AND rider_id = $2')) return [{ id: REQUEST_ID }];
      return [];
    });
    await expect(
      submitJoinRequest(active.client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-3', NOW),
    ).resolves.toMatchObject({ kind: 'already_requested' });

    const waiting = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) return [];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('FROM rider_suspensions')) return [];
      if (sql.includes("type = 'campus'")) return [{ id: 'hall-3' }];
      if (sql.includes('WHERE ride_id = $1 AND rider_id = $2')) return [];
      if (sql.includes('count(*)::int AS count')) return [{ count: 3 }];
      return [];
    });
    await expect(
      submitJoinRequest(waiting.client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-4', NOW),
    ).resolves.toMatchObject({ kind: 'active_request_limit' });
  });

  it('prevents a request that conflicts with an already accepted ride', async () => {
    const { client } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) return [];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('FROM rider_suspensions')) return [];
      if (sql.includes("type = 'campus'")) return [{ id: 'hall-3' }];
      if (sql.includes('WHERE ride_id = $1 AND rider_id = $2')) return [];
      if (sql.includes('count(*)::int AS count')) return [{ count: 0 }];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share')) return [ownerSeat];
      if (sql.includes('abs(extract(epoch')) return [{ id: 'conflicting-ride' }];
      return [];
    });
    await expect(
      submitJoinRequest(client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-5', NOW),
    ).resolves.toMatchObject({ kind: 'departure_conflict' });
  });

  it('locks a ride at its deadline and refuses a request with an unavailable pickup estimate', async () => {
    const dueRide = { ...ride, departure_start: new Date(NOW.getTime() + 30 * 60_000) };
    const due = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) return [];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [dueRide];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share')) return [ownerSeat];
      return [];
    });
    await expect(
      submitJoinRequest(due.client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-6', NOW),
    ).resolves.toMatchObject({ kind: 'ride_locked' });
    expect(due.query.mock.calls.some(([sql]) => sql.includes('SET locked_at = $2'))).toBe(true);

    const unknownPickup = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM ride_join_request_keys request_key')) return [];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('FROM rider_suspensions')) return [];
      if (sql.includes("type = 'campus'")) return [{ id: 'hall-3' }];
      if (sql.includes('WHERE ride_id = $1 AND rider_id = $2')) return [];
      if (sql.includes('count(*)::int AS count')) return [{ count: 0 }];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share')) return [ownerSeat];
      if (sql.includes('abs(extract(epoch')) return [];
      if (sql.includes('SELECT id, name FROM locations')) {
        return [
          { id: 'hall-1', name: 'Hall 1' },
          { id: 'hall-3', name: 'New Campus Point' },
        ];
      }
      return [];
    });
    await expect(
      submitJoinRequest(unknownPickup.client, RIDE_ID, RIDER_ID, 'hall-3', 'attempt-7', NOW),
    ).resolves.toMatchObject({ kind: 'pickup_estimate_unavailable' });
  });
});

describe('actOnJoinRequest', () => {
  it('accepts a pending request, inserts the rider seat and records the transition', async () => {
    let seatRead = 0;
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT rider_id FROM ride_join_requests WHERE id = $1 AND ride_id = $2')) {
        return [{ rider_id: RIDER_ID }];
      }
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (
        sql.includes('FROM ride_join_requests WHERE id = $1 AND ride_id = $2 FOR NO KEY UPDATE')
      ) {
        return [requestRow('pending')];
      }
      if (sql.includes('FROM rider_suspensions')) return [];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share')) {
        seatRead += 1;
        return seatRead === 1 ? [ownerSeat] : [ownerSeat, riderSeat];
      }
      if (sql.includes('SELECT request.id, request.ride_id, ride.owner_id')) return [];
      if (sql.includes("WHERE ride_id = $1 AND status = 'accepted'"))
        return [requestRow('accepted')];
      if (sql.includes('SELECT id, name FROM locations')) {
        return [
          { id: 'hall-1', name: 'Hall 1' },
          { id: 'hall-3', name: 'Hall 3' },
        ];
      }
      if (sql.includes('abs(extract(epoch')) return [];
      return [];
    });

    await expect(
      actOnJoinRequest(client, RIDE_ID, REQUEST_ID, OWNER_ID, 'accept', NOW),
    ).resolves.toEqual({ kind: 'accepted', requestId: REQUEST_ID });
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO riders'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("SET status = 'accepted'"))).toBe(true);
    expect(
      query.mock.calls.some(([sql]) => sql.includes('INSERT INTO ride_join_request_events')),
    ).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO notifications'))).toBe(true);
  });

  it('requires rider reconfirmation before the owner can accept changed terms', async () => {
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT rider_id FROM ride_join_requests WHERE id = $1 AND ride_id = $2')) {
        return [{ rider_id: RIDER_ID }];
      }
      if (sql.includes('SELECT id FROM users')) return [{ id: RIDER_ID }];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (
        sql.includes('FROM ride_join_requests WHERE id = $1 AND ride_id = $2 FOR NO KEY UPDATE')
      ) {
        return [{ ...requestRow(), status: 'needs_reconfirmation' }];
      }
      return [];
    });

    await expect(
      actOnJoinRequest(client, RIDE_ID, REQUEST_ID, OWNER_ID, 'accept', NOW),
    ).resolves.toMatchObject({ kind: 'request_not_pending' });
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO riders'))).toBe(false);
  });

  it('returns not found for a missing request and rejects an owner action by another account', async () => {
    const missing = makeClient(() => []);
    await expect(
      actOnJoinRequest(missing.client, RIDE_ID, REQUEST_ID, OWNER_ID, 'accept', NOW),
    ).resolves.toMatchObject({ kind: 'not_found' });

    const wrongOwner = makeActionClient();
    await expect(
      actOnJoinRequest(wrongOwner.client, RIDE_ID, REQUEST_ID, RIDER_ID, 'accept', NOW),
    ).resolves.toMatchObject({ kind: 'not_owner' });
  });

  it('rejects a waiting request and notifies its rider', async () => {
    const { client, query } = makeActionClient();
    await expect(
      actOnJoinRequest(client, RIDE_ID, REQUEST_ID, OWNER_ID, 'reject', NOW),
    ).resolves.toEqual({ kind: 'rejected', requestId: REQUEST_ID });
    expect(query.mock.calls.some(([sql]) => sql.includes("SET status = 'rejected'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO notifications'))).toBe(true);
  });

  it('reconfirms the latest terms and changes the request back to pending', async () => {
    const { client, query } = makeActionClient({ status: 'needs_reconfirmation' });
    await expect(
      actOnJoinRequest(client, RIDE_ID, REQUEST_ID, RIDER_ID, 'reconfirm', NOW),
    ).resolves.toEqual({ kind: 'reconfirmed', requestId: REQUEST_ID });
    expect(query.mock.calls.some(([sql]) => sql.includes("SET status = 'pending'"))).toBe(true);
    expect(
      query.mock.calls.some(
        ([sql, values]) =>
          sql.includes('INSERT INTO ride_join_request_events') &&
          values?.includes('rider_reconfirmed'),
      ),
    ).toBe(true);
  });

  it('allows a rider to decline changed terms and withdraw an ordinary pending request', async () => {
    const reconfirming = makeActionClient({ status: 'needs_reconfirmation' });
    await expect(
      actOnJoinRequest(reconfirming.client, RIDE_ID, REQUEST_ID, RIDER_ID, 'decline', NOW),
    ).resolves.toMatchObject({ kind: 'withdrawn' });

    const pending = makeActionClient();
    await expect(
      actOnJoinRequest(pending.client, RIDE_ID, REQUEST_ID, RIDER_ID, 'withdraw', NOW),
    ).resolves.toMatchObject({ kind: 'withdrawn' });
    expect(
      pending.query.mock.calls.some(
        ([sql, values]) =>
          sql.includes('INSERT INTO ride_join_request_events') &&
          values?.includes('rider_withdrew'),
      ),
    ).toBe(true);
  });

  it('expires a reconfirmation at lock time and commits the expiry transition', async () => {
    const locked = makeActionClient({ status: 'needs_reconfirmation', lockedAt: NOW });
    await expect(
      actOnJoinRequest(locked.client, RIDE_ID, REQUEST_ID, RIDER_ID, 'reconfirm', NOW),
    ).resolves.toMatchObject({ kind: 'expired' });
    expect(locked.query.mock.calls.some(([sql]) => sql.includes("SET status = 'expired'"))).toBe(
      true,
    );
  });

  it('lets an accepted rider leave before lock and releases their active seat', async () => {
    const { client, query } = makeActionClient({ status: 'accepted' });
    await expect(
      actOnJoinRequest(client, RIDE_ID, REQUEST_ID, RIDER_ID, 'leave', NOW),
    ).resolves.toMatchObject({ kind: 'left', lateCancellation: false });
    expect(query.mock.calls.some(([sql]) => sql.includes('SET left_at = $3'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("SET status = 'left'"))).toBe(true);
  });

  it('requires confirmation to leave after lock and retains the locked share', async () => {
    const locked = makeActionClient({ status: 'accepted', lockedAt: NOW });
    await expect(
      actOnJoinRequest(locked.client, RIDE_ID, REQUEST_ID, RIDER_ID, 'leave', NOW),
    ).resolves.toMatchObject({ kind: 'late_confirmation_required' });

    const confirmed = makeActionClient({ status: 'accepted', lockedAt: NOW });
    await expect(
      actOnJoinRequest(confirmed.client, RIDE_ID, REQUEST_ID, RIDER_ID, 'leave', NOW, true),
    ).resolves.toMatchObject({ kind: 'left', lateCancellation: true, lockedShare: 200 });
  });
});

describe('owner ride lifecycle integration', () => {
  it('locks a scheduled ride, fixes active shares, expires waiting requests, and notifies the pool', async () => {
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: OWNER_ID }];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share'))
        return [ownerSeat, riderSeat];
      if (sql.includes("WHERE ride_id = $1 AND status = 'accepted'"))
        return [requestRow('accepted')];
      if (sql.includes("WHERE ride_id = $1 AND status IN ('pending', 'needs_reconfirmation')")) {
        return [requestRow()];
      }
      return [];
    });

    await expect(lockRideForOwner(client, RIDE_ID, OWNER_ID, NOW)).resolves.toEqual({
      kind: 'locked',
      rideId: RIDE_ID,
    });
    expect(query.mock.calls.some(([sql]) => sql.includes('SET locked_at = $2'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('SET locked_share = $3'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("SET status = 'expired'"))).toBe(true);
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO notifications')).length,
    ).toBeGreaterThan(1);
  });

  it('cancels a scheduled ride, releases seat liability, and records pending and accepted cancellations', async () => {
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: OWNER_ID }];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('WHERE ride_id = $1 AND status = ANY')) {
        return [
          requestRow('accepted'),
          { ...requestRow(), id: '9c4d5e6f-5555-4000-8000-000000000005' },
        ];
      }
      return [];
    });

    await expect(cancelRideForOwner(client, RIDE_ID, OWNER_ID, NOW)).resolves.toEqual({
      kind: 'cancelled',
      rideId: RIDE_ID,
    });
    expect(query.mock.calls.some(([sql]) => sql.includes("SET state = 'cancelled'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('SET locked_share = NULL'))).toBe(true);
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO ride_join_request_events'))
        .length,
    ).toBe(2);
  });

  it('requires confirmation before an owner edit can affect accepted riders', async () => {
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: OWNER_ID }];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) return [ride];
      if (sql.includes('SELECT hub_id FROM rides')) return [{ hub_id: 'kanpur-central' }];
      if (sql.includes('SELECT user_id, campus_location_id, locked_share'))
        return [ownerSeat, riderSeat];
      if (sql.includes('SELECT capacity FROM vehicle_types')) return [{ capacity: 4 }];
      if (sql.includes("type = 'transport_hub'")) return [{ id: 'kanpur-central' }];
      if (sql.includes("WHERE ride_id = $1 AND status = 'accepted'")) return [{ count: 1 }];
      return [];
    });

    await expect(
      editRideForOwner(client, RIDE_ID, OWNER_ID, { expectedTotalFare: 500 }, false, NOW),
    ).resolves.toMatchObject({ kind: 'confirmation_required' });
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE rides'))).toBe(false);
  });

  it('does not allow cancellation once pickup time has started', async () => {
    const { client, query } = makeClient((sql) => {
      if (sql.includes('SELECT id FROM users')) return [{ id: OWNER_ID }];
      if (sql.includes('FROM rides WHERE id = $1 FOR NO KEY UPDATE')) {
        return [{ ...ride, departure_start: new Date(NOW.getTime() - 1) }];
      }
      return [];
    });

    await expect(cancelRideForOwner(client, RIDE_ID, OWNER_ID, NOW)).resolves.toMatchObject({
      kind: 'trip_started',
    });
    expect(query.mock.calls.some(([sql]) => sql.includes("SET state = 'cancelled'"))).toBe(false);
  });
});
