import { describe, expect, it } from 'vitest';
import { getCampusTravelTimeMinutes } from './ai/campus-travel-times';
import {
  pickupTimeFor,
  tripItinerary,
  type ItinerarySeat,
  type TravelTime,
} from './trip-itinerary';

const departure = new Date('2026-10-13T18:00:00+05:30');
const at = (minutes: number) => new Date(departure.getTime() + minutes * 60_000);

const owner: ItinerarySeat = { seatId: 'owner', place: 'Hall 1', isOwner: true };

// A small line of places: A, B, C, D in a row, one minute apart.
const line: TravelTime = (from, to) => {
  const position: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  if (!(from in position) || !(to in position)) return null;
  return Math.abs(position[from] - position[to]);
};

describe('trip itinerary (FR-RD-10.2)', () => {
  it("starts leaving campus at the owner's place at the start of the window", () => {
    const itinerary = tripItinerary('to_hub', departure, [owner]);
    expect(itinerary).toEqual({
      kind: 'pickup',
      stops: [{ place: 'Hall 1', seatIds: ['owner'], estimatedAt: departure }],
    });
  });

  it('goes to the nearest place not yet visited, adding up the minutes', () => {
    const seats: ItinerarySeat[] = [
      { seatId: 'owner', place: 'B', isOwner: true },
      { seatId: 'r1', place: 'D', isOwner: false },
      { seatId: 'r2', place: 'A', isOwner: false },
      { seatId: 'r3', place: 'C', isOwner: false },
    ];
    // From B, A and C are both 1 minute away; A's seat comes first, so A wins the tie. Then
    // from A, C is nearer than D (2 minutes against 3), and D comes last.
    const itinerary = tripItinerary('to_hub', departure, seats, line);
    expect(itinerary.stops.map((stop) => [stop.place, stop.estimatedAt])).toEqual([
      ['B', departure],
      ['A', at(1)],
      ['C', at(3)],
      ['D', at(4)],
    ]);
  });

  it('puts people at the same place on one stop, in seat order', () => {
    const seats: ItinerarySeat[] = [
      { seatId: 'owner', place: 'A', isOwner: true },
      { seatId: 'r1', place: 'C', isOwner: false },
      { seatId: 'r2', place: 'A', isOwner: false },
      { seatId: 'r3', place: 'C', isOwner: false },
    ];
    expect(tripItinerary('to_hub', departure, seats, line).stops).toEqual([
      { place: 'A', seatIds: ['owner', 'r2'], estimatedAt: departure },
      { place: 'C', seatIds: ['r1', 'r3'], estimatedAt: at(2) },
    ]);
  });

  it('puts a place the estimates do not know last, without a time', () => {
    const seats: ItinerarySeat[] = [
      { seatId: 'owner', place: 'A', isOwner: true },
      { seatId: 'r1', place: 'Somewhere new', isOwner: false },
      { seatId: 'r2', place: 'B', isOwner: false },
    ];
    expect(tripItinerary('to_hub', departure, seats, line).stops).toEqual([
      { place: 'A', seatIds: ['owner'], estimatedAt: departure },
      { place: 'B', seatIds: ['r2'], estimatedAt: at(1) },
      { place: 'Somewhere new', seatIds: ['r1'], estimatedAt: null },
    ]);
  });

  it('lists drop-offs from the Main Gate, without times, coming to campus', () => {
    const seats: ItinerarySeat[] = [
      { seatId: 'owner', place: 'Hall 1', isOwner: true },
      { seatId: 'r1', place: 'Hall 10', isOwner: false },
    ];
    // Main Gate is 7 minutes from Hall 10 and 14 from Hall 1 in the campus estimates.
    expect(tripItinerary('from_hub', departure, seats)).toEqual({
      kind: 'drop_off',
      stops: [
        { place: 'Hall 10', seatIds: ['r1'], estimatedAt: null },
        { place: 'Hall 1', seatIds: ['owner'], estimatedAt: null },
      ],
    });
  });

  it('uses the real campus estimates by default', () => {
    const seats: ItinerarySeat[] = [
      { seatId: 'owner', place: 'Hall 1', isOwner: true },
      { seatId: 'r1', place: 'Hall 2', isOwner: false },
    ];
    const minutes = getCampusTravelTimeMinutes('Hall 1', 'Hall 2')!;
    expect(tripItinerary('to_hub', departure, seats).stops[1].estimatedAt).toEqual(at(minutes));
  });

  it('has no stops without seats', () => {
    expect(tripItinerary('to_hub', departure, [])).toEqual({ kind: 'pickup', stops: [] });
  });
});

describe('pickup time for the no-show grace period (P-19)', () => {
  const seats: ItinerarySeat[] = [
    { seatId: 'owner', place: 'A', isOwner: true },
    { seatId: 'r1', place: 'C', isOwner: false },
    { seatId: 'r2', place: 'Nowhere', isOwner: false },
  ];

  it("is the seat's estimated stop time leaving campus", () => {
    const itinerary = tripItinerary('to_hub', departure, seats, line);
    expect(pickupTimeFor(itinerary, 'r1', departure)).toEqual(at(2));
  });

  it('falls back to the start of the window for an unknown place, an unknown seat, or coming to campus', () => {
    const leaving = tripItinerary('to_hub', departure, seats, line);
    expect(pickupTimeFor(leaving, 'r2', departure)).toEqual(departure);
    expect(pickupTimeFor(leaving, 'nobody', departure)).toEqual(departure);
    const coming = tripItinerary('from_hub', departure, seats, line);
    expect(pickupTimeFor(coming, 'r1', departure)).toEqual(departure);
  });
});
