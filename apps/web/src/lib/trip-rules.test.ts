import { describe, expect, it } from 'vitest';
import { RIDE_STATES, type RideState } from './ride-status';
import {
  ACTIVE_TRIP_STATES,
  TRIP_TARGETS,
  arrivalRefusal,
  canLeave,
  checkInRefusal,
  isActiveSeat,
  isTripActive,
  noShowAvailableAt,
  noShowRefusal,
  parseArrivalRequest,
  parseTripRequest,
  rideLocked,
  seatRefusalMessages,
  seatStatus,
  seatStatusLabels,
  tripRefusalMessages,
  tripTransitionRefusal,
  type PickupSeat,
} from './trip-rules';

const SEAT = '2b0f1f8e-4c1a-4a43-9b51-0d7f2b7c9a10';
const departure = new Date('2026-10-13T18:00:00+05:30');
const minutes = (count: number) => new Date(departure.getTime() + count * 60_000);
const rider: PickupSeat = { isOwner: false, leftAt: null, arrivedAt: null, noShowAt: null };

describe('trip states (FR-RO-09.1, FR-RO-09.4, FR-RD-10.1)', () => {
  it('treats Pickup in Progress and In Transit as the trip under way', () => {
    expect(ACTIVE_TRIP_STATES).toEqual(['pickup_in_progress', 'in_transit']);
    expect(RIDE_STATES.filter(isTripActive)).toEqual(['pickup_in_progress', 'in_transit']);
  });

  it('lets only the owner move the trip', () => {
    expect(
      tripTransitionRefusal('rider', 'scheduled', 'pickup_in_progress', departure, minutes(-30)),
    ).toBe('not_owner');
    expect(
      tripTransitionRefusal('visitor', 'pickup_in_progress', 'completed', departure, departure),
    ).toBe('not_owner');
  });

  it('starts pickup only once the ride is locked, an hour before departure', () => {
    expect(
      tripTransitionRefusal('owner', 'scheduled', 'pickup_in_progress', departure, minutes(-61)),
    ).toBe('not_locked');
    expect(
      tripTransitionRefusal('owner', 'scheduled', 'pickup_in_progress', departure, minutes(-60)),
    ).toBeNull();
  });

  it('also starts pickup once the owner locked the ride early (FR-RO-06.2)', () => {
    const early = minutes(-120);
    expect(rideLocked(null, departure, early)).toBe(false);
    expect(rideLocked(minutes(-150), departure, early)).toBe(true);
    expect(
      tripTransitionRefusal(
        'owner',
        'scheduled',
        'pickup_in_progress',
        departure,
        early,
        minutes(-150),
      ),
    ).toBeNull();
    expect(
      checkInRefusal('scheduled', departure, early, rider, '2026-10-13T10:00:00.000Z'),
    ).toBeNull();
  });

  it('starts a ride only within its departure window', () => {
    const end = minutes(60);
    expect(
      tripTransitionRefusal(
        'owner',
        'scheduled',
        'pickup_in_progress',
        departure,
        minutes(59),
        null,
        end,
      ),
    ).toBeNull();
    expect(
      tripTransitionRefusal('owner', 'scheduled', 'pickup_in_progress', departure, end, null, end),
    ).toBe('window_over');
    // A trip already under way is never cut off by the clock.
    expect(
      tripTransitionRefusal(
        'owner',
        'pickup_in_progress',
        'completed',
        departure,
        minutes(300),
        null,
        end,
      ),
    ).toBeNull();
  });

  it('allows exactly the D1 order of steps, In Transit being optional', () => {
    const allowed: Array<[RideState, (typeof TRIP_TARGETS)[number]]> = [];
    for (const state of RIDE_STATES) {
      for (const to of TRIP_TARGETS) {
        if (
          state !== to &&
          tripTransitionRefusal('owner', state, to, departure, departure) === null
        ) {
          allowed.push([state, to]);
        }
      }
    }
    expect(allowed).toEqual([
      ['scheduled', 'pickup_in_progress'],
      ['pickup_in_progress', 'in_transit'],
      ['pickup_in_progress', 'completed'],
      ['in_transit', 'completed'],
    ]);
  });

  it('names why every other step is refused', () => {
    expect(tripTransitionRefusal('owner', 'scheduled', 'completed', departure, departure)).toBe(
      'not_started',
    );
    expect(tripTransitionRefusal('owner', 'scheduled', 'in_transit', departure, departure)).toBe(
      'invalid_transition',
    );
    expect(
      tripTransitionRefusal('owner', 'in_transit', 'pickup_in_progress', departure, departure),
    ).toBe('invalid_transition');
    expect(tripTransitionRefusal('owner', 'cancelled', 'completed', departure, departure)).toBe(
      'cancelled',
    );
    expect(tripTransitionRefusal('owner', 'completed', 'in_transit', departure, departure)).toBe(
      'completed',
    );
    for (const message of Object.values(tripRefusalMessages)) expect(message).toMatch(/\.$/);
  });

  it('does not refuse the state the ride is already in, so a double tap does no harm', () => {
    for (const to of TRIP_TARGETS) {
      expect(tripTransitionRefusal('owner', to, to, departure, departure)).toBeNull();
    }
  });
});

describe('seats at pickup (FR-RO-09.3, FR-RO-10, FR-RD-10.4)', () => {
  it('names where a seat stands, the most final fact first', () => {
    const empty = { leftAt: null, checkedInAt: null, arrivedAt: null, noShowAt: null };
    expect(seatStatus(empty)).toBe('waiting');
    expect(seatStatus({ ...empty, checkedInAt: departure })).toBe('checked_in');
    expect(seatStatus({ ...empty, checkedInAt: departure, arrivedAt: departure })).toBe('arrived');
    expect(seatStatus({ ...empty, noShowAt: '2026-10-13T12:40:00.000Z' })).toBe('no_show');
    expect(seatStatus({ ...empty, noShowAt: departure, leftAt: departure })).toBe('left');
    expect(seatStatusLabels.checked_in).toBe('At the pickup point');
  });

  it('keeps a seat in the pool unless it left or was a no-show (FR-RO-10.2)', () => {
    expect(isActiveSeat({ leftAt: null, noShowAt: null })).toBe(true);
    expect(isActiveSeat({ leftAt: departure, noShowAt: null })).toBe(false);
    expect(isActiveSeat({ leftAt: null, noShowAt: departure })).toBe(false);
  });

  it('lets the owner mark arrivals only during pickup, for riders still on the ride', () => {
    expect(arrivalRefusal('owner', 'pickup_in_progress', rider)).toBeNull();
    expect(arrivalRefusal('rider', 'pickup_in_progress', rider)).toBe('not_owner');
    expect(arrivalRefusal('owner', 'scheduled', rider)).toBe('not_in_pickup');
    expect(arrivalRefusal('owner', 'in_transit', rider)).toBe('not_in_pickup');
    expect(arrivalRefusal('owner', 'pickup_in_progress', { ...rider, isOwner: true })).toBe(
      'owner_seat',
    );
    expect(arrivalRefusal('owner', 'pickup_in_progress', { ...rider, leftAt: departure })).toBe(
      'not_on_ride',
    );
    expect(arrivalRefusal('owner', 'pickup_in_progress', { ...rider, noShowAt: departure })).toBe(
      'no_show',
    );
  });

  it('allows a no-show from 5 minutes after the pickup time, not a moment sooner (P-19)', () => {
    expect(noShowAvailableAt(departure)).toEqual(minutes(5));
    expect(
      noShowRefusal(
        'owner',
        'pickup_in_progress',
        rider,
        departure,
        new Date(minutes(5).getTime() - 1),
      ),
    ).toBe('grace_period');
    expect(noShowRefusal('owner', 'pickup_in_progress', rider, departure, minutes(5))).toBeNull();
  });

  it('refuses a no-show outside pickup, for the owner, a rider who left or one who arrived', () => {
    const late = minutes(30);
    expect(noShowRefusal('rider', 'pickup_in_progress', rider, departure, late)).toBe('not_owner');
    expect(noShowRefusal('owner', 'in_transit', rider, departure, late)).toBe('not_in_pickup');
    expect(
      noShowRefusal('owner', 'pickup_in_progress', { ...rider, isOwner: true }, departure, late),
    ).toBe('owner_seat');
    expect(
      noShowRefusal(
        'owner',
        'pickup_in_progress',
        { ...rider, leftAt: departure },
        departure,
        late,
      ),
    ).toBe('not_on_ride');
    expect(
      noShowRefusal(
        'owner',
        'pickup_in_progress',
        { ...rider, arrivedAt: departure },
        departure,
        late,
      ),
    ).toBe('arrived');
  });

  it('treats a no-show already recorded as done', () => {
    expect(
      noShowRefusal(
        'owner',
        'pickup_in_progress',
        { ...rider, noShowAt: departure },
        departure,
        departure,
      ),
    ).toBeNull();
  });

  it('lets a rider check in from the lock until the trip starts', () => {
    expect(checkInRefusal('scheduled', departure, minutes(-61), rider)).toBe('not_open');
    expect(checkInRefusal('scheduled', departure, minutes(-60), rider)).toBeNull();
    expect(checkInRefusal('pickup_in_progress', departure, departure, rider)).toBeNull();
    expect(checkInRefusal('in_transit', departure, departure, rider)).toBe('not_open');
    expect(checkInRefusal('completed', departure, departure, rider)).toBe('not_open');
    expect(
      checkInRefusal('pickup_in_progress', departure, departure, { ...rider, isOwner: true }),
    ).toBe('owner_seat');
    expect(
      checkInRefusal('pickup_in_progress', departure, departure, { ...rider, leftAt: departure }),
    ).toBe('not_on_ride');
    expect(
      checkInRefusal('pickup_in_progress', departure, departure, { ...rider, noShowAt: departure }),
    ).toBe('no_show');
    for (const message of Object.values(seatRefusalMessages)) expect(message).toMatch(/\.$/);
  });

  it('lets a rider leave only while the ride is scheduled (FR-RD-07.5)', () => {
    expect(RIDE_STATES.filter(canLeave)).toEqual(['scheduled']);
  });
});

describe('trip requests', () => {
  it('reads the step to move to', () => {
    expect(parseTripRequest({ to: 'in_transit' })).toEqual({
      ok: true,
      value: { to: 'in_transit' },
    });
    expect(parseTripRequest({ to: 'scheduled' })).toEqual({
      ok: false,
      errors: { to: expect.any(String) },
    });
    expect(parseTripRequest(null).ok).toBe(false);
    expect(parseTripRequest(['completed']).ok).toBe(false);
  });

  it('reads an arrival by seat, never by account', () => {
    expect(parseArrivalRequest({ occupantId: SEAT.toUpperCase(), status: 'no_show' })).toEqual({
      ok: true,
      value: { occupantId: SEAT, status: 'no_show' },
    });
    expect(parseArrivalRequest({ occupantId: 'seat-1', status: 'late' })).toEqual({
      ok: false,
      errors: { occupantId: expect.any(String), status: expect.any(String) },
    });
    expect(parseArrivalRequest(undefined).ok).toBe(false);
  });
});
