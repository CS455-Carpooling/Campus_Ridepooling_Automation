/**
 * The order of the stops on a trip and each stop's estimated time (CS455-60, FR-RD-10.2).
 *
 * Leaving campus, the owner starts at their own place at the start of the departure window, then
 * drives to the nearest place not yet visited, and so on; people at the same place share a stop.
 * Coming to campus, everyone boards at the hub at the start of the window, and the stops are
 * where they get out, from the Main Gate, without times. Travel times come from the campus
 * estimates in src/lib/ai/campus-travel-times.ts, which are rough, so every time is shown as an
 * estimate. A place those estimates do not know goes last, without a time.
 *
 * Pure: the travel-time lookup can be swapped in tests.
 */
import { getCampusTravelTimeMinutes } from './ai/campus-travel-times';
import type { Direction } from './ride-rules';

/** Minutes between two places, or null when unknown. */
export type TravelTime = (from: string, to: string) => number | null;

/** One seat, by its riders.id and the name of its campus place. Owner first, then by joining. */
export type ItinerarySeat = { seatId: string; place: string; isOwner: boolean };

export type ItineraryStop = {
  place: string;
  /** The seats picked up (or dropped off) here, in seat order. */
  seatIds: string[];
  /** When the vehicle should reach this stop, or null when that cannot be estimated. */
  estimatedAt: Date | null;
};

export type Itinerary = {
  /** Leaving campus the stops are pickups; coming to campus they are drop-offs. */
  kind: 'pickup' | 'drop_off';
  stops: ItineraryStop[];
};

/** Where a trip coming from a hub enters the campus. */
const CAMPUS_ENTRY = 'Main Gate';

const MINUTE = 60_000;

export function tripItinerary(
  direction: Direction,
  departureStart: Date,
  seats: readonly ItinerarySeat[],
  travel: TravelTime = getCampusTravelTimeMinutes,
): Itinerary {
  const kind = direction === 'to_hub' ? 'pickup' : 'drop_off';

  // Places in seat order, each with its seats, so ties keep the owner's and earlier joiners' places first.
  const seatsAt = new Map<string, string[]>();
  for (const seat of seats) {
    const here = seatsAt.get(seat.place);
    if (here) here.push(seat.seatId);
    else seatsAt.set(seat.place, [seat.seatId]);
  }
  if (seatsAt.size === 0) return { kind, stops: [] };

  const stops: ItineraryStop[] = [];
  const remaining = [...seatsAt.keys()];
  let current: string;
  let minutes = 0;

  if (kind === 'pickup') {
    const owner = seats.find((seat) => seat.isOwner) ?? seats[0];
    current = owner.place;
    remaining.splice(remaining.indexOf(current), 1);
    stops.push({ place: current, seatIds: seatsAt.get(current)!, estimatedAt: departureStart });
  } else {
    current = CAMPUS_ENTRY;
  }

  while (remaining.length > 0) {
    let next = -1;
    let nextMinutes = Infinity;
    remaining.forEach((place, index) => {
      const time = travel(current, place);
      if (time !== null && time < nextMinutes) {
        next = index;
        nextMinutes = time;
      }
    });
    if (next === -1) break;

    const [place] = remaining.splice(next, 1);
    minutes += nextMinutes;
    current = place;
    stops.push({
      place,
      seatIds: seatsAt.get(place)!,
      estimatedAt: kind === 'pickup' ? new Date(departureStart.getTime() + minutes * MINUTE) : null,
    });
  }

  for (const place of remaining) {
    stops.push({ place, seatIds: seatsAt.get(place)!, estimatedAt: null });
  }
  return { kind, stops };
}

/**
 * When this seat is picked up, which the no-show grace period counts from (P-19): its stop's
 * estimated time leaving campus; otherwise the start of the departure window, because coming to
 * campus everyone boards at the hub, and an unknown place has no estimate.
 */
export function pickupTimeFor(itinerary: Itinerary, seatId: string, departureStart: Date): Date {
  if (itinerary.kind !== 'pickup') return departureStart;
  const stop = itinerary.stops.find((candidate) => candidate.seatIds.includes(seatId));
  return stop?.estimatedAt ?? departureStart;
}
