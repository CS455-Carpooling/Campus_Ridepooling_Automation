/**
 * Rules for creating a ride, shared by the create-ride form (CS455-24, 25) and
 * POST /api/rides (CS455-23), so the two always agree. Pure functions only: no
 * database, no React.
 */
import { splitFare } from './fare';
import { formatRupees } from './format';
import type { RideFormOptions } from './ride-options';

/** to_hub: from campus to a transport hub. from_hub: from a hub back to campus. */
export type Direction = 'to_hub' | 'from_hub';

export const RIDE_RULES = {
  /** A ride locks an hour before it leaves (P-06), so it cannot start sooner than that. */
  minLeadMinutes: 60,
  /** The departure window tells riders when to be ready; keep it short enough to plan. */
  maxWindowMinutes: 180,
  minFare: 1,
  maxFare: 50_000,
} as const;

/** The body of POST /api/rides. Times are ISO 8601 with an offset; the fare is whole rupees. */
export type CreateRideRequest = {
  direction: Direction;
  hubId: string;
  campusLocationId: string;
  vehicleTypeId: string;
  departureStart: string;
  departureEnd: string;
  expectedTotalFare: number;
};

export type RideField = keyof CreateRideRequest;

/** One message per field, written for the person filling in the form. */
export type RideErrors = Partial<Record<RideField, string>>;

export type RideValidation =
  { ok: true; value: CreateRideRequest } | { ok: false; errors: RideErrors };

/** The IDs a request may use, as stored in the database. */
export type KnownRideIds = {
  hubIds: readonly string[];
  campusLocationIds: readonly string[];
  vehicleTypeIds: readonly string[];
};

export const rideMessages = {
  direction: 'Choose whether you are leaving campus or coming to campus.',
  hubId: 'Choose a station, stand or airport from the list.',
  campusLocationId: 'Choose your hall or Main Gate from the list.',
  vehicleTypeId: 'Choose a vehicle.',
  startMissing: 'Enter the earliest time you will leave.',
  startTooSoon: 'The ride locks an hour before it leaves, so start at least 1 hour from now.',
  endMissing: 'Enter the latest time you will leave.',
  endBeforeStart: 'The latest time must be after the earliest time.',
  windowTooLong: 'Keep the window to 3 hours or less, so riders can plan.',
  fare: `Enter the total fare in whole rupees, from ${formatRupees(RIDE_RULES.minFare)} to ${formatRupees(RIDE_RULES.maxFare)}.`,
} as const;

const MINUTE = 60_000;
// Year, month, day, hour, minute, optional second, and the offset's hours and minutes (none for Z).
const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// Indian Standard Time has no daylight saving: always UTC+05:30.
const IST_OFFSET_MINUTES = 330;
// Real time zones run from UTC-12:00 to UTC+14:00.
const MAX_OFFSET_MINUTES = 14 * 60;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  const leapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 && leapYear ? 29 : DAYS_IN_MONTH[month - 1];
}

/**
 * An ISO 8601 time with an offset, or null. Every part is range-checked first:
 * JavaScript rolls a date that does not exist over (31 November becomes
 * 1 December) and accepts offsets up to 23:59, but PostgreSQL rejects both, so
 * such a time would fail the insert instead of being reported here.
 */
function parseTime(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = ISO_WITH_OFFSET.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second, offsetHours, offsetMinutes] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const realDate = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
  const realClock = hour <= 23 && minute <= 59 && second <= 59;
  const realOffset = offsetMinutes <= 59 && offsetHours * 60 + offsetMinutes <= MAX_OFFSET_MINUTES;
  if (!realDate || !realClock || !realOffset) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time;
}

const isKnown = (value: unknown, ids: readonly string[]): value is string =>
  typeof value === 'string' && ids.includes(value);

/**
 * Checks a create-ride request. `input` is untrusted (a parsed JSON body or the
 * form's values); `now` is passed in so the time rules can be tested.
 */
export function validateRideRequest(
  input: Record<string, unknown>,
  known: KnownRideIds,
  now: Date,
): RideValidation {
  const errors: RideErrors = {};

  if (input.direction !== 'to_hub' && input.direction !== 'from_hub') {
    errors.direction = rideMessages.direction;
  }
  if (!isKnown(input.hubId, known.hubIds)) errors.hubId = rideMessages.hubId;
  if (!isKnown(input.campusLocationId, known.campusLocationIds)) {
    errors.campusLocationId = rideMessages.campusLocationId;
  }
  if (!isKnown(input.vehicleTypeId, known.vehicleTypeIds)) {
    errors.vehicleTypeId = rideMessages.vehicleTypeId;
  }

  const start = parseTime(input.departureStart);
  const end = parseTime(input.departureEnd);
  if (!start) {
    errors.departureStart = rideMessages.startMissing;
  } else if (start.getTime() < now.getTime() + RIDE_RULES.minLeadMinutes * MINUTE) {
    errors.departureStart = rideMessages.startTooSoon;
  }
  if (!end) {
    errors.departureEnd = rideMessages.endMissing;
  } else if (start && end.getTime() <= start.getTime()) {
    errors.departureEnd = rideMessages.endBeforeStart;
  } else if (start && end.getTime() - start.getTime() > RIDE_RULES.maxWindowMinutes * MINUTE) {
    errors.departureEnd = rideMessages.windowTooLong;
  }

  const fare = input.expectedTotalFare;
  if (
    typeof fare !== 'number' ||
    !Number.isInteger(fare) ||
    fare < RIDE_RULES.minFare ||
    fare > RIDE_RULES.maxFare
  ) {
    errors.expectedTotalFare = rideMessages.fare;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      direction: input.direction as Direction,
      hubId: input.hubId as string,
      campusLocationId: input.campusLocationId as string,
      vehicleTypeId: input.vehicleTypeId as string,
      departureStart: input.departureStart as string,
      departureEnd: input.departureEnd as string,
      expectedTotalFare: fare as number,
    },
  };
}

/** The IDs offered by the form, in the shape validateRideRequest expects. */
export function knownRideIds(options: RideFormOptions): KnownRideIds {
  return {
    hubIds: options.hubs.map((place) => place.id),
    campusLocationIds: options.campusPlaces.map((place) => place.id),
    vehicleTypeIds: options.vehicleTypes.map((vehicle) => vehicle.id),
  };
}

/**
 * A datetime-local value such as "2026-10-10T06:30", read as Indian Standard
 * Time, in ISO 8601 with its offset. An empty string if the value is not a
 * complete date and time.
 */
export function toIstIso(localDateTime: string): string {
  return LOCAL_DATE_TIME.test(localDateTime) ? `${localDateTime}:00+05:30` : '';
}

/**
 * The earliest start the rules allow, as a datetime-local value in IST, for the
 * input's `min`. Rounded up to the next whole minute.
 */
export function minDepartureLocal(now: Date): string {
  const earliest = now.getTime() + RIDE_RULES.minLeadMinutes * MINUTE;
  const roundedUp = Math.ceil(earliest / MINUTE) * MINUTE;
  return new Date(roundedUp + IST_OFFSET_MINUTES * MINUTE).toISOString().slice(0, 16);
}

/**
 * A datetime-local value moved by some minutes, for the inputs' min and max.
 * Plain clock arithmetic: IST has no daylight saving. Empty if the value is incomplete.
 */
export function addMinutesLocal(localDateTime: string, minutes: number): string {
  if (!LOCAL_DATE_TIME.test(localDateTime)) return '';
  const time = new Date(`${localDateTime}:00Z`).getTime();
  if (Number.isNaN(time)) return '';
  return new Date(time + minutes * MINUTE).toISOString().slice(0, 16);
}

/** The fare as typed in the form, if it is whole rupees within the limits; otherwise null. */
export function fareFromText(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,9}$/.test(trimmed)) return null;
  const fare = Number(trimmed);
  return fare >= RIDE_RULES.minFare && fare <= RIDE_RULES.maxFare ? fare : null;
}

/**
 * The most anyone pays when `people` share the fare, the owner included
 * (Table T-2: the owner and the earliest riders pay the extra rupee). Null
 * until the fare and the number of people are usable.
 */
export function largestShare(totalFare: number, people: number): number | null {
  if (!Number.isSafeInteger(totalFare) || totalFare < RIDE_RULES.minFare) return null;
  if (!Number.isSafeInteger(people) || people < 1) return null;
  return splitFare(totalFare, people)[0];
}

/** What the form holds: every value as typed or chosen, possibly empty. */
export type RideDraft = Record<RideField, string>;

export const emptyRideDraft: RideDraft = {
  direction: '',
  hubId: '',
  campusLocationId: '',
  vehicleTypeId: '',
  departureStart: '',
  departureEnd: '',
  expectedTotalFare: '',
};

/** Turns the form's values into a request body for validateRideRequest and the API. */
export function requestFromDraft(draft: RideDraft): Record<string, unknown> {
  const fare = draft.expectedTotalFare.trim();
  return {
    ...draft,
    departureStart: toIstIso(draft.departureStart),
    departureEnd: toIstIso(draft.departureEnd),
    expectedTotalFare: /^\d{1,9}$/.test(fare) ? Number(fare) : fare,
  };
}
