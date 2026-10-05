import { describe, expect, it } from 'vitest';
import {
  RIDE_STATES,
  campusPlaceLabel,
  canViewRide,
  directionLabels,
  isLocked,
  isOpenToJoin,
  lockTime,
  rideStateLabels,
  rideTitle,
} from './ride-status';

// Departure 06:30 IST on Saturday 10 October 2026, so the ride locks at 05:30 IST.
const departure = new Date('2026-10-10T06:30:00+05:30');
const lock = new Date('2026-10-10T05:30:00+05:30');
const justBefore = new Date(lock.getTime() - 1);

describe('labels', () => {
  it('FR-RD-10.1: gives every state a text label', () => {
    expect(RIDE_STATES.map((state) => rideStateLabels[state])).toEqual([
      'Scheduled',
      'Pickup in progress',
      'In transit',
      'Completed',
      'Cancelled',
    ]);
  });

  it('names a ride after its hub, in its direction', () => {
    expect(rideTitle('to_hub', 'Kanpur Central')).toBe('To Kanpur Central');
    expect(rideTitle('from_hub', 'Kanpur Central')).toBe('From Kanpur Central');
    expect(directionLabels).toEqual({ to_hub: 'Leaving campus', from_hub: 'Coming to campus' });
  });

  it('calls the campus place a pickup when leaving and a drop-off when arriving', () => {
    expect(campusPlaceLabel('to_hub')).toBe('Pickup');
    expect(campusPlaceLabel('from_hub')).toBe('Drop-off');
  });
});

describe('lock time (P-06)', () => {
  it('is an hour before departure', () => {
    expect(lockTime(departure)).toEqual(lock);
  });

  it('counts as locked from that moment on', () => {
    expect(isLocked(departure, justBefore)).toBe(false);
    expect(isLocked(departure, lock)).toBe(true);
  });

  it('keeps a scheduled ride open to join until then', () => {
    expect(isOpenToJoin('scheduled', departure, justBefore)).toBe(true);
    expect(isOpenToJoin('scheduled', departure, lock)).toBe(false);
  });

  it.each(['pickup_in_progress', 'in_transit', 'completed', 'cancelled'] as const)(
    'never opens a %s ride to join',
    (state) => {
      expect(isOpenToJoin(state, departure, justBefore)).toBe(false);
    },
  );
});

describe('canViewRide (NFR-RD-09)', () => {
  it('lets the owner and riders see their ride in every state, even after it locks', () => {
    for (const state of RIDE_STATES) {
      expect(canViewRide('owner', state, departure, lock)).toBe(true);
      expect(canViewRide('rider', state, departure, lock)).toBe(true);
    }
  });

  it('lets anyone else see a ride only while it is open to join', () => {
    expect(canViewRide('visitor', 'scheduled', departure, justBefore)).toBe(true);
    expect(canViewRide('visitor', 'scheduled', departure, lock)).toBe(false);
    expect(canViewRide('visitor', 'cancelled', departure, justBefore)).toBe(false);
    expect(canViewRide('visitor', 'completed', departure, justBefore)).toBe(false);
  });
});
