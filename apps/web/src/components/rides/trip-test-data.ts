import type { RideOccupant, RideView, TripView } from '@/lib/ride-view';

/**
 * A ride under way for the trip component tests (CS455-63): leaving Hall 1 for Kanpur Central at
 * 18:00 IST on Tuesday 13 October 2026, with two riders.
 */
export const TRIP_RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';

export function occupant(change: Partial<RideOccupant> = {}): RideOccupant {
  return {
    occupantId: 's-rider',
    name: 'Kabir Shah',
    campusPlace: 'Hall 2',
    isOwner: false,
    isViewer: false,
    visibleTags: [],
    completedTrips: 0,
    share: 100,
    rating: null,
    status: 'waiting',
    noShowAvailableAt: null,
    ...change,
  };
}

export const ownerSeat = occupant({
  occupantId: 's-owner',
  name: 'Ananya Rao',
  campusPlace: 'Hall 1',
  isOwner: true,
});
export const nearSeat = occupant({ occupantId: 's-near', name: 'Kabir Shah' });
export const farSeat = occupant({
  occupantId: 's-far',
  name: 'Meera Iyer',
  campusPlace: 'Hall 4',
});

export function tripView(change: Partial<TripView> = {}): TripView {
  return {
    pickupStartedAt: null,
    tripStartedAt: null,
    stopKind: 'pickup',
    stops: [
      {
        place: 'Hall 1',
        estimatedAt: '2026-10-13T12:30:00.000Z',
        occupantIds: ['s-owner'],
        people: ['Ananya Rao'],
      },
      {
        place: 'Hall 2',
        estimatedAt: '2026-10-13T12:34:00.000Z',
        occupantIds: ['s-near'],
        people: ['Kabir Shah'],
      },
      {
        place: 'Hall 4',
        estimatedAt: null,
        occupantIds: ['s-far'],
        people: ['Meera Iyer'],
      },
    ],
    viewerPickupAt: null,
    canStartPickup: false,
    canStartTrip: false,
    canCheckIn: false,
    viewerNoShow: false,
    ...change,
  };
}

export function tripRide(change: Partial<RideView> = {}): RideView {
  return {
    id: TRIP_RIDE_ID,
    direction: 'to_hub',
    hub: { name: 'Kanpur Central', detail: null },
    departureStart: '2026-10-13T12:30:00.000Z',
    departureEnd: '2026-10-13T13:30:00.000Z',
    lockAt: '2026-10-13T11:30:00.000Z',
    state: 'scheduled',
    isLocked: true,
    isOpen: false,
    windowEnded: false,
    completedAt: null,
    canComplete: false,
    trip: tripView(),
    canComplain: false,
    review: null,
    vehicleName: 'Car',
    capacity: 4,
    occupantCount: 3,
    seatsLeft: 1,
    totalFare: 300,
    occupants: [ownerSeat, nearSeat, farSeat],
    viewerRole: 'owner',
    viewerShare: 100,
    estimatedShare: null,
    readAt: '2026-10-13T12:00:00.000Z',
    ...change,
  };
}
