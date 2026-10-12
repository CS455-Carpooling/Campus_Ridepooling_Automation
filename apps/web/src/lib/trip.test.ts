// @vitest-environment node
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  TRIP_STAMP_SQL,
  activeShares,
  changeTripState,
  checkIn,
  itineraryFor,
  markNoShow,
  setArrival,
  type SeatRow,
} from './trip';

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const OWNER = '6f1c2a5e-2222-4000-8000-000000000001';
const RIDER = '6f1c2a5e-2222-4000-8000-000000000002';
const OTHER = '6f1c2a5e-2222-4000-8000-000000000003';
const STRANGER = '6f1c2a5e-2222-4000-8000-0000000000ff';

// Leaves Hall 1 at 18:00 IST on Tuesday 13 October 2026; locks at 17:00.
const departure = new Date('2026-10-13T18:00:00+05:30');
const at = (minutes: number) => new Date(departure.getTime() + minutes * 60_000);

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

function seat(id: string, userId: string, change: Partial<SeatRow> = {}): SeatRow {
  return {
    id,
    user_id: userId,
    is_owner: false,
    place: 'Hall 1',
    left_at: null,
    checked_in_at: null,
    arrived_at: null,
    no_show_at: null,
    ...change,
  };
}

const ownerSeat = seat('s-owner', OWNER, { is_owner: true });
const riderSeat = seat('s-rider', RIDER, { place: 'Hall 2' });
const otherSeat = seat('s-other', OTHER, { place: 'Hall 4' });

function tripClient(
  ride: Record<string, unknown> | null,
  seats: SeatRow[] = [ownerSeat, riderSeat, otherSeat],
) {
  const query = vi.fn<Query>(async (sql, params) => {
    if (sql.includes('FOR NO KEY UPDATE OF r')) {
      return {
        rows: ride
          ? [
              {
                id: RIDE,
                owner_id: OWNER,
                state: 'scheduled',
                direction: 'to_hub',
                departure_start: departure,
                expected_total_fare: 301,
                hub_name: 'Kanpur Central',
                pickup_started_at: null,
                trip_started_at: null,
                completed_at: null,
                ...ride,
              },
            ]
          : [],
      };
    }
    if (sql.includes('FROM riders m')) return { rows: seats };
    if (sql.includes('UPDATE riders SET') && sql.includes('RETURNING')) {
      const target = seats.find((candidate) => candidate.id === params?.[0])!;
      if (sql.includes('no_show_at = $2')) {
        return { rows: [{ ...target, no_show_at: params?.[1] }] };
      }
      if (sql.includes('SET checked_in_at')) {
        return { rows: [{ ...target, checked_in_at: target.checked_in_at ?? params?.[1] }] };
      }
      return { rows: [{ ...target, arrived_at: params?.[1] ? params?.[2] : null }] };
    }
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, query };
}

const sqlOf = (query: ReturnType<typeof vi.fn>, text: string) =>
  query.mock.calls.filter(([sql]) => String(sql).includes(text));

describe('activeShares (FR-RO-10.2, Table T-2)', () => {
  it('splits the fare between the seats still in the pool, in seat order', () => {
    expect(
      activeShares(
        [
          { leftAt: null, noShowAt: null },
          { leftAt: null, noShowAt: at(10) },
          { leftAt: null, noShowAt: null },
          { leftAt: at(-90), noShowAt: null },
        ],
        301,
      ),
    ).toEqual([151, null, 150, null]);
  });

  it('gives nobody a share when nobody is left', () => {
    expect(activeShares([{ leftAt: at(0), noShowAt: null }], 300)).toEqual([null]);
  });
});

describe('itineraryFor', () => {
  it('leaves out seats that left', () => {
    const stops = itineraryFor('to_hub', departure, [
      ownerSeat,
      riderSeat,
      seat('s-gone', STRANGER, { place: 'Hall 9', left_at: at(-120) }),
    ]).stops;
    expect(stops.map((stop) => stop.place)).toEqual(['Hall 1', 'Hall 2']);
  });
});

describe('changeTripState (FR-RO-09.1, 09.4, FR-RD-10.1)', () => {
  it('answers not found for a ride that does not exist, or one the user may not see', async () => {
    await expect(
      changeTripState(tripClient(null).client, RIDE, OWNER, 'pickup_in_progress', at(-30)),
    ).resolves.toEqual({ kind: 'not_found' });
    // Locked, so a stranger may no longer see it.
    await expect(
      changeTripState(tripClient({}).client, RIDE, STRANGER, 'pickup_in_progress', at(-30)),
    ).resolves.toEqual({ kind: 'not_found' });
  });

  it('refuses a rider, and the owner before the lock', async () => {
    await expect(
      changeTripState(tripClient({}).client, RIDE, RIDER, 'pickup_in_progress', at(-30)),
    ).resolves.toEqual({ kind: 'refused', code: 'not_owner' });
    const { client, query } = tripClient({});
    await expect(
      changeTripState(client, RIDE, OWNER, 'pickup_in_progress', at(-61)),
    ).resolves.toEqual({ kind: 'refused', code: 'not_locked' });
    expect(sqlOf(query, ' SET ')).toHaveLength(0);
  });

  it('starts pickup, keeping its time, and tells the riders but not the owner (FR-RO-09.2)', async () => {
    const { client, query } = tripClient({});
    const result = await changeTripState(client, RIDE, OWNER, 'pickup_in_progress', at(-30));
    expect(result).toEqual({
      kind: 'done',
      value: {
        id: RIDE,
        state: 'pickup_in_progress',
        pickupStartedAt: at(-30).toISOString(),
        tripStartedAt: null,
        completedAt: null,
      },
    });
    const [update] = sqlOf(query, 'UPDATE rides');
    expect(update[0]).toContain('pickup_started_at = $3');
    expect(update[1]).toEqual([RIDE, 'pickup_in_progress', at(-30)]);
    const [notice] = sqlOf(query, 'INSERT INTO notifications');
    expect(notice[1]).toEqual([
      [RIDER, OTHER],
      'trip_update',
      'Pickup has started',
      expect.stringContaining('To Kanpur Central'),
      RIDE,
    ]);
  });

  it('changes nothing when the ride is already in that state', async () => {
    const { client, query } = tripClient({
      state: 'pickup_in_progress',
      pickup_started_at: at(-30),
    });
    const result = await changeTripState(client, RIDE, OWNER, 'pickup_in_progress', at(-20));
    expect(result).toMatchObject({
      kind: 'done',
      value: { pickupStartedAt: at(-30).toISOString() },
    });
    expect(sqlOf(query, ' SET ')).toHaveLength(0);
    expect(sqlOf(query, 'INSERT')).toHaveLength(0);
  });

  it('starts the trip, counting riders not yet marked as on board', async () => {
    const { client, query } = tripClient({
      state: 'pickup_in_progress',
      pickup_started_at: at(-10),
    });
    const result = await changeTripState(client, RIDE, OWNER, 'in_transit', at(5));
    expect(result).toMatchObject({
      kind: 'done',
      value: { state: 'in_transit', tripStartedAt: at(5).toISOString() },
    });
    const [onBoard] = sqlOf(query, 'UPDATE riders SET arrived_at = $2');
    expect(onBoard[0]).toContain('no_show_at IS NULL AND arrived_at IS NULL');
    expect(onBoard[1]).toEqual([RIDE, at(5), OWNER]);
    expect(sqlOf(query, 'INSERT INTO ride_final_shares')).toHaveLength(0);
  });

  it('completes the ride, storing the final pool and shares without the no-show (FR-RO-09.4)', async () => {
    const seats = [ownerSeat, riderSeat, seat('s-other', OTHER, { no_show_at: at(10) })];
    const { client, query } = tripClient(
      { state: 'in_transit', pickup_started_at: at(-10), trip_started_at: at(15) },
      seats,
    );
    const result = await changeTripState(client, RIDE, OWNER, 'completed', at(60));
    expect(result).toMatchObject({
      kind: 'done',
      value: { state: 'completed', completedAt: at(60).toISOString() },
    });
    const [final] = sqlOf(query, 'INSERT INTO ride_final_shares');
    expect(final[1]).toEqual([RIDE, [OWNER, RIDER], ['owner', 'rider'], [1, 2], [151, 150]]);
    // Only riders still in the pool hear that it is completed.
    const [notice] = sqlOf(query, 'INSERT INTO notifications');
    expect(notice[1]?.[0]).toEqual([RIDER]);
    // Leaving In Transit marks nobody: they were marked on board when the trip started.
    expect(sqlOf(query, 'UPDATE riders')).toHaveLength(0);
  });

  it('refuses to complete a ride whose trip never started', async () => {
    await expect(
      changeTripState(tripClient({}).client, RIDE, OWNER, 'completed', at(60)),
    ).resolves.toEqual({ kind: 'refused', code: 'not_started' });
  });

  it('sends no notification when nobody but the owner is on the ride', async () => {
    const { client, query } = tripClient({}, [ownerSeat]);
    await changeTripState(client, RIDE, OWNER, 'pickup_in_progress', at(-30));
    expect(sqlOf(query, 'INSERT INTO notifications')).toHaveLength(0);
  });
});

describe('setArrival (FR-RO-09.3)', () => {
  const inPickup = { state: 'pickup_in_progress', pickup_started_at: at(-10) };

  it('marks a rider arrived, and undoes it', async () => {
    const { client, query } = tripClient(inPickup);
    await expect(setArrival(client, RIDE, OWNER, 's-rider', true, at(2))).resolves.toEqual({
      kind: 'done',
      value: {
        occupantId: 's-rider',
        checkedInAt: null,
        arrivedAt: at(2).toISOString(),
        noShowAt: null,
      },
    });
    expect(sqlOf(query, 'UPDATE riders')[0][1]).toEqual(['s-rider', true, at(2)]);
    await expect(setArrival(client, RIDE, OWNER, 's-rider', false, at(3))).resolves.toMatchObject({
      value: { arrivedAt: null },
    });
  });

  it('refuses an unknown seat, a rider acting, and any time outside pickup', async () => {
    await expect(
      setArrival(tripClient(inPickup).client, RIDE, OWNER, 'nobody', true, at(2)),
    ).resolves.toEqual({
      kind: 'seat_not_found',
    });
    await expect(
      setArrival(tripClient(inPickup).client, RIDE, RIDER, 's-other', true, at(2)),
    ).resolves.toEqual({
      kind: 'refused',
      code: 'not_owner',
    });
    await expect(
      setArrival(tripClient({}).client, RIDE, OWNER, 's-rider', true, at(-30)),
    ).resolves.toEqual({
      kind: 'refused',
      code: 'not_in_pickup',
    });
    await expect(
      setArrival(tripClient(null).client, RIDE, OWNER, 's-rider', true, at(2)),
    ).resolves.toEqual({
      kind: 'not_found',
    });
  });
});

describe('markNoShow (FR-RO-10.1 to 10.3, FR-RD-10.3)', () => {
  const inPickup = { state: 'pickup_in_progress', pickup_started_at: at(-10) };

  it("refuses before 5 minutes after the rider's estimated pickup time, and says when", async () => {
    // Hall 2 is 4 minutes from the owner's Hall 1, so the grace period ends at +9.
    const { client, query } = tripClient(inPickup);
    await expect(markNoShow(client, RIDE, OWNER, 's-rider', at(8))).resolves.toEqual({
      kind: 'refused',
      code: 'grace_period',
      availableAt: at(9).toISOString(),
    });
    expect(sqlOf(query, ' SET ')).toHaveLength(0);
  });

  it('records the no-show and tells only that rider, with how to dispute it', async () => {
    const { client, query } = tripClient(inPickup);
    await expect(markNoShow(client, RIDE, OWNER, 's-rider', at(9))).resolves.toEqual({
      kind: 'done',
      value: {
        occupantId: 's-rider',
        checkedInAt: null,
        arrivedAt: null,
        noShowAt: at(9).toISOString(),
      },
    });
    expect(sqlOf(query, 'UPDATE riders')[0][1]).toEqual(['s-rider', at(9), OWNER]);
    const [notice] = sqlOf(query, 'INSERT INTO notifications');
    expect(notice[1]).toEqual([
      [RIDER],
      'no_show_recorded',
      'You were marked as a no-show',
      expect.stringContaining('report it from the ride page within 7 days'),
      RIDE,
    ]);
  });

  it('treats a no-show already recorded as done, and refuses other reasons', async () => {
    const seats = [
      ownerSeat,
      seat('s-rider', RIDER, { no_show_at: at(9) }),
      seat('s-other', OTHER, { arrived_at: at(1) }),
    ];
    const { client, query } = tripClient(inPickup, seats);
    await expect(markNoShow(client, RIDE, OWNER, 's-rider', at(30))).resolves.toMatchObject({
      kind: 'done',
      value: { noShowAt: at(9).toISOString() },
    });
    await expect(markNoShow(client, RIDE, OWNER, 's-other', at(30))).resolves.toEqual({
      kind: 'refused',
      code: 'arrived',
    });
    await expect(markNoShow(client, RIDE, OWNER, 'nobody', at(30))).resolves.toEqual({
      kind: 'seat_not_found',
    });
    await expect(
      markNoShow(tripClient(null).client, RIDE, OWNER, 's-rider', at(30)),
    ).resolves.toEqual({
      kind: 'not_found',
    });
    expect(sqlOf(query, ' SET ')).toHaveLength(0);
  });
});

describe('checkIn (FR-RD-10.4)', () => {
  it('records that a rider is at their pickup point, once', async () => {
    const { client, query } = tripClient({
      state: 'pickup_in_progress',
      pickup_started_at: at(-10),
    });
    await expect(checkIn(client, RIDE, RIDER, at(-2))).resolves.toEqual({
      kind: 'done',
      value: {
        occupantId: 's-rider',
        checkedInAt: at(-2).toISOString(),
        arrivedAt: null,
        noShowAt: null,
      },
    });
    expect(sqlOf(query, 'COALESCE(checked_in_at, $2)')).toHaveLength(1);
  });

  it('refuses before the lock and for the owner, and answers not found to a stranger', async () => {
    await expect(checkIn(tripClient({}).client, RIDE, RIDER, at(-90))).resolves.toEqual({
      kind: 'refused',
      code: 'not_open',
    });
    await expect(checkIn(tripClient({}).client, RIDE, OWNER, at(-30))).resolves.toEqual({
      kind: 'refused',
      code: 'owner_seat',
    });
    await expect(checkIn(tripClient({}).client, RIDE, STRANGER, at(-90))).resolves.toEqual({
      kind: 'not_found',
    });
    await expect(checkIn(tripClient(null).client, RIDE, RIDER, at(-30))).resolves.toEqual({
      kind: 'not_found',
    });
  });
});

describe('the trip stamp (P-13)', () => {
  it('covers the ride and every seat, for seat holders who have not left', () => {
    expect(TRIP_STAMP_SQL).toContain('md5(');
    expect(TRIP_STAMP_SQL).toContain('m.no_show_at');
    expect(TRIP_STAMP_SQL).toContain('me.left_at IS NULL');
  });
});
