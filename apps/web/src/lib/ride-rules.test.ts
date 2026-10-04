import { describe, expect, it } from 'vitest';
import {
  addMinutesLocal,
  emptyRideDraft,
  fareFromText,
  largestShare,
  knownRideIds,
  minDepartureLocal,
  requestFromDraft,
  rideMessages,
  toIstIso,
  validateRideRequest,
  type KnownRideIds,
} from './ride-rules';

const known: KnownRideIds = {
  hubIds: ['kanpur-central', 'lucknow-airport'],
  campusLocationIds: ['hall-6', 'main-gate'],
  vehicleTypeIds: ['car', 'auto'],
};

// Midnight in IST on Saturday 10 October 2026.
const now = new Date('2026-10-10T00:00:00+05:30');

const valid = {
  direction: 'to_hub',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-6',
  vehicleTypeId: 'car',
  departureStart: '2026-10-10T06:30:00+05:30',
  departureEnd: '2026-10-10T07:30:00+05:30',
  expectedTotalFare: 460,
};

const errorsFor = (change: Record<string, unknown>) => {
  const result = validateRideRequest({ ...valid, ...change }, known, now);
  return result.ok ? {} : result.errors;
};

describe('validateRideRequest', () => {
  it('accepts a complete ride and returns it typed', () => {
    expect(validateRideRequest(valid, known, now)).toEqual({ ok: true, value: valid });
  });

  it('reports every missing field at once', () => {
    const result = validateRideRequest({}, known, now);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : Object.keys(result.errors).sort()).toEqual([
      'campusLocationId',
      'departureEnd',
      'departureStart',
      'direction',
      'expectedTotalFare',
      'hubId',
      'vehicleTypeId',
    ]);
  });

  it.each([
    [{ direction: 'sideways' }, 'direction', rideMessages.direction],
    [{ hubId: 'delhi-airport' }, 'hubId', rideMessages.hubId],
    [{ campusLocationId: 'hall-99' }, 'campusLocationId', rideMessages.campusLocationId],
    [{ vehicleTypeId: 'helicopter' }, 'vehicleTypeId', rideMessages.vehicleTypeId],
    [{ hubId: 42 }, 'hubId', rideMessages.hubId],
  ])('rejects %o', (change, field, message) => {
    expect(errorsFor(change)).toEqual({ [field]: message });
  });

  describe('departure window', () => {
    it('must start at least an hour from now, because the ride locks an hour before', () => {
      expect(
        errorsFor({
          departureStart: '2026-10-10T00:59:00+05:30',
          departureEnd: '2026-10-10T01:30:00+05:30',
        }),
      ).toEqual({
        departureStart: rideMessages.startTooSoon,
      });
      expect(
        errorsFor({
          departureStart: '2026-10-10T01:00:00+05:30',
          departureEnd: '2026-10-10T02:00:00+05:30',
        }),
      ).toEqual({});
    });

    it('must end after it starts', () => {
      expect(errorsFor({ departureEnd: valid.departureStart })).toEqual({
        departureEnd: rideMessages.endBeforeStart,
      });
      expect(errorsFor({ departureEnd: '2026-10-10T06:00:00+05:30' })).toEqual({
        departureEnd: rideMessages.endBeforeStart,
      });
    });

    it('may last up to 3 hours', () => {
      expect(errorsFor({ departureEnd: '2026-10-10T09:30:00+05:30' })).toEqual({});
      expect(errorsFor({ departureEnd: '2026-10-10T09:31:00+05:30' })).toEqual({
        departureEnd: rideMessages.windowTooLong,
      });
    });

    it('compares instants, whatever offset each time is written in', () => {
      // 01:00 UTC is 06:30 IST: a 60-minute window.
      expect(errorsFor({ departureEnd: '2026-10-10T02:00:00Z' })).toEqual({});
    });

    it('needs ISO times with an offset', () => {
      expect(errorsFor({ departureStart: '2026-10-10T06:30' })).toEqual({
        departureStart: rideMessages.startMissing,
      });
      expect(errorsFor({ departureEnd: '' })).toEqual({ departureEnd: rideMessages.endMissing });
      expect(errorsFor({ departureEnd: '2026-13-01T07:30:00+05:30' })).toEqual({
        departureEnd: rideMessages.endMissing,
      });
    });
  });

  it.each([0, 1.5, 'abc', '460', 50_001, -10, Number.NaN])('rejects a fare of %o', (fare) => {
    expect(errorsFor({ expectedTotalFare: fare })).toEqual({
      expectedTotalFare: rideMessages.fare,
    });
  });

  it('accepts the fare limits themselves', () => {
    expect(errorsFor({ expectedTotalFare: 1 })).toEqual({});
    expect(errorsFor({ expectedTotalFare: 50_000 })).toEqual({});
  });

  it('words the fare limits for people', () => {
    expect(rideMessages.fare).toBe('Enter the total fare in whole rupees, from ₹1 to ₹50,000.');
  });
});

describe('time helpers', () => {
  it('reads a datetime-local value as Indian Standard Time', () => {
    expect(toIstIso('2026-10-10T06:30')).toBe('2026-10-10T06:30:00+05:30');
    expect(toIstIso('2026-10-10')).toBe('');
    expect(toIstIso('')).toBe('');
  });

  it('gives the earliest allowed start in IST, rounded up to the minute', () => {
    expect(minDepartureLocal(new Date('2026-10-09T23:30:20Z'))).toBe('2026-10-10T06:01');
    expect(minDepartureLocal(new Date('2026-10-09T23:30:00Z'))).toBe('2026-10-10T06:00');
  });

  it('moves to the next day when an hour from now is past midnight in IST', () => {
    expect(minDepartureLocal(new Date('2026-10-10T17:45:00Z'))).toBe('2026-10-11T00:15');
  });
});

describe('largestShare', () => {
  it('is the largest share when that many people ride (Table T-2)', () => {
    expect(largestShare(460, 4)).toBe(115);
    expect(largestShare(463, 4)).toBe(116);
    expect(largestShare(700, 7)).toBe(100);
    expect(largestShare(460, 2)).toBe(230);
  });

  it('is null until the fare and the number of people are usable', () => {
    expect(largestShare(0, 4)).toBeNull();
    expect(largestShare(12.5, 4)).toBeNull();
    expect(largestShare(460, 0)).toBeNull();
    expect(largestShare(460, 2.5)).toBeNull();
  });
});

describe('form value helpers', () => {
  it('moves a datetime-local value by minutes, across midnight too', () => {
    expect(addMinutesLocal('2026-10-10T06:30', 180)).toBe('2026-10-10T09:30');
    expect(addMinutesLocal('2026-10-10T23:30', 90)).toBe('2026-10-11T01:00');
    expect(addMinutesLocal('2026-10-10', 60)).toBe('');
    expect(addMinutesLocal('2026-13-10T06:30', 60)).toBe('');
  });

  it('reads a typed fare only when it is whole rupees within the limits', () => {
    expect(fareFromText(' 460 ')).toBe(460);
    expect(fareFromText('1')).toBe(1);
    expect(fareFromText('50000')).toBe(50_000);
    for (const text of ['', '0', '12.5', '4,600', 'abc', '50001']) {
      expect(fareFromText(text)).toBeNull();
    }
  });
});

describe('the form draft', () => {
  const draft = {
    direction: 'from_hub',
    hubId: 'lucknow-airport',
    campusLocationId: 'main-gate',
    vehicleTypeId: 'auto',
    departureStart: '2026-10-10T18:00',
    departureEnd: '2026-10-10T19:30',
    expectedTotalFare: ' 1450 ',
  };

  it('becomes a request body: IST times and a whole-rupee number', () => {
    expect(requestFromDraft(draft)).toEqual({
      ...draft,
      departureStart: '2026-10-10T18:00:00+05:30',
      departureEnd: '2026-10-10T19:30:00+05:30',
      expectedTotalFare: 1450,
    });
    expect(
      validateRideRequest(
        requestFromDraft(draft),
        {
          ...known,
          hubIds: ['lucknow-airport'],
        },
        now,
      ).ok,
    ).toBe(true);
  });

  it('keeps a fare that is not a whole number as typed, so validation rejects it', () => {
    expect(requestFromDraft({ ...draft, expectedTotalFare: '12.5' }).expectedTotalFare).toBe(
      '12.5',
    );
  });

  it('starts empty', () => {
    expect(Object.values(emptyRideDraft).every((value) => value === '')).toBe(true);
  });
});

describe('knownRideIds', () => {
  it('maps the database-backed form option shape into validator ids', () => {
    const ids = knownRideIds({
      hubs: [
        { id: 'kanpur-central', name: 'Kanpur Central' },
        { id: 'metro-station', name: 'Metro station' },
      ],
      campusPlaces: [{ id: 'main-gate', name: 'Main Gate' }],
      vehicleTypes: [
        { id: 'car', name: 'Car', capacity: 4 },
        { id: 'auto', name: 'Auto', capacity: 3 },
        { id: 'vikram', name: 'Vikram', capacity: 7 },
      ],
    });
    expect(ids.hubIds).toContain('metro-station');
    expect(ids.campusLocationIds).toContain('main-gate');
    expect(ids.vehicleTypeIds).toEqual(['car', 'auto', 'vikram']);
  });
});
