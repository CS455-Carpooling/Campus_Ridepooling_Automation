import { describe, expect, it } from 'vitest';
import {
  RATING_RULES,
  completeRideRefusal,
  offersComplaint,
  parseRatingsRequest,
  ratingClosesAt,
  ratingMessages,
  ratingWindow,
  scoreChoices,
} from './rating-rules';
import { RIDE_STATES } from './ride-status';

// Departure 06:30 IST on Saturday 10 October 2026; the owner marks it completed at 08:05.
const departure = new Date('2026-10-10T06:30:00+05:30');
const completedAt = new Date('2026-10-10T08:05:00+05:30');
const closesAt = new Date('2026-10-13T08:05:00+05:30');
const HOUR = 3_600_000;

const seatA = '2b0f1f8e-4c1a-4a43-9b51-0d7f2b7c9a10';
const seatB = 'c5d1a3b2-7e44-4f0e-8a6c-3e9b1d2f4a77';

describe('the rating window (P-16)', () => {
  it('closes 72 hours after the ride is completed', () => {
    expect(RATING_RULES.windowHours).toBe(72);
    expect(ratingClosesAt(completedAt)).toEqual(closesAt);
  });

  it('US-RD-28 AC1: is open from completion until just before 72 hours, and closed from then on', () => {
    expect(ratingWindow('completed', completedAt, completedAt)).toBe('open');
    expect(ratingWindow('completed', completedAt, new Date(closesAt.getTime() - 1_000))).toBe(
      'open',
    );
    expect(ratingWindow('completed', completedAt, closesAt)).toBe('closed');
    expect(
      ratingWindow('completed', completedAt, new Date(completedAt.getTime() + 80 * HOUR)),
    ).toBe('closed');
  });

  it.each(['scheduled', 'pickup_in_progress', 'in_transit'] as const)(
    'is not open on a %s ride',
    (state) => {
      expect(ratingWindow(state, null, completedAt)).toBe('not_completed');
    },
  );

  it('is never open on a cancelled ride', () => {
    expect(ratingWindow('cancelled', null, completedAt)).toBe('cancelled');
  });

  it('treats a completed ride without a completion time as not completed', () => {
    expect(ratingWindow('completed', null, completedAt)).toBe('not_completed');
  });
});

describe('completeRideRefusal (FR-RO-09.4)', () => {
  it('lets only the owner complete a ride', () => {
    for (const state of RIDE_STATES) {
      expect(completeRideRefusal('rider', state, departure, completedAt)).toBe('not_owner');
      expect(completeRideRefusal('visitor', state, departure, completedAt)).toBe('not_owner');
    }
  });

  it('lets the owner complete it from the start of the departure window', () => {
    expect(
      completeRideRefusal('owner', 'scheduled', departure, new Date(departure.getTime() - 1)),
    ).toBe('too_early');
    expect(completeRideRefusal('owner', 'scheduled', departure, departure)).toBeNull();
    expect(completeRideRefusal('owner', 'pickup_in_progress', departure, completedAt)).toBeNull();
    expect(completeRideRefusal('owner', 'in_transit', departure, completedAt)).toBeNull();
  });

  it('never completes a cancelled ride, nor a completed one again', () => {
    expect(completeRideRefusal('owner', 'cancelled', departure, completedAt)).toBe('cancelled');
    expect(completeRideRefusal('owner', 'completed', departure, completedAt)).toBe(
      'already_completed',
    );
  });
});

describe('parseRatingsRequest (FR-RD-12.1)', () => {
  it('accepts one or more ratings, with or without a comment', () => {
    expect(
      parseRatingsRequest({
        ratings: [
          { occupantId: seatA, score: 4 },
          { occupantId: seatB, score: 2, comment: 'Arrived 20 minutes late.' },
        ],
      }),
    ).toEqual({
      ok: true,
      ratings: [
        { occupantId: seatA, score: 4, comment: null },
        { occupantId: seatB, score: 2, comment: 'Arrived 20 minutes late.' },
      ],
    });
  });

  it('trims comments and stores an empty one as none', () => {
    const result = parseRatingsRequest({
      ratings: [
        { occupantId: seatA, score: 5, comment: '  On time.  ' },
        { occupantId: seatB, score: 3, comment: '   ' },
      ],
    });
    expect(result).toEqual({
      ok: true,
      ratings: [
        { occupantId: seatA, score: 5, comment: 'On time.' },
        { occupantId: seatB, score: 3, comment: null },
      ],
    });
    expect(
      parseRatingsRequest({ ratings: [{ occupantId: seatA, score: 5, comment: null }] }),
    ).toEqual({ ok: true, ratings: [{ occupantId: seatA, score: 5, comment: null }] });
  });

  it('lower-cases seat IDs', () => {
    const result = parseRatingsRequest({
      ratings: [{ occupantId: seatA.toUpperCase(), score: 5 }],
    });
    expect(result).toEqual({ ok: true, ratings: [{ occupantId: seatA, score: 5, comment: null }] });
  });

  it.each([
    ['no body', undefined],
    ['a body that is not an object', 'ratings'],
    ['a list on its own', [{ occupantId: seatA, score: 4 }]],
    ['no list', {}],
    ['an empty list', { ratings: [] }],
    [
      'more than 10 ratings',
      { ratings: Array.from({ length: 11 }, () => ({ occupantId: seatA, score: 4 })) },
    ],
  ])('refuses %s', (_case, body) => {
    expect(parseRatingsRequest(body)).toEqual({ ok: false, error: ratingMessages.list });
  });

  it.each([
    ['an entry that is not an object', 'seat'],
    ['a missing seat', { score: 4 }],
    ['a seat that is not a UUID', { occupantId: 'dev-student', score: 4 }],
  ])('refuses %s', (_case, entry) => {
    expect(parseRatingsRequest({ ratings: [entry] })).toEqual({
      ok: false,
      error: ratingMessages.person,
    });
  });

  it.each([
    ['0', 0],
    ['6', 6],
    ['4.5', 4.5],
    ['"4" as text', '4'],
    ['NaN', Number.NaN],
    ['no score', undefined],
  ])('refuses a score of %s', (_case, score) => {
    expect(parseRatingsRequest({ ratings: [{ occupantId: seatA, score }] })).toEqual({
      ok: false,
      error: ratingMessages.score,
    });
  });

  it('refuses a comment without a score', () => {
    expect(
      parseRatingsRequest({ ratings: [{ occupantId: seatA, comment: 'Great trip.' }] }),
    ).toEqual({ ok: false, error: ratingMessages.score });
  });

  it('allows 500 characters in a comment, counting an emoji as one, and refuses 501', () => {
    const at = (comment: unknown) =>
      parseRatingsRequest({ ratings: [{ occupantId: seatA, score: 4, comment }] });
    expect(at('a'.repeat(500)).ok).toBe(true);
    expect(at('\u{1F697}'.repeat(500)).ok).toBe(true);
    expect(at('a'.repeat(501))).toEqual({ ok: false, error: ratingMessages.comment });
    expect(at(42)).toEqual({ ok: false, error: ratingMessages.comment });
  });

  it('US-RD-28 AC2: refuses rating the same person twice in one request', () => {
    expect(
      parseRatingsRequest({
        ratings: [
          { occupantId: seatA, score: 4 },
          { occupantId: seatA.toUpperCase(), score: 5 },
        ],
      }),
    ).toEqual({ ok: false, error: ratingMessages.duplicate });
  });
});

describe('scores', () => {
  it('names every score from 1 to 5', () => {
    expect(scoreChoices.map((choice) => `${choice.score} ${choice.label}`)).toEqual([
      '1 Poor',
      '2 Fair',
      '3 Good',
      '4 Very good',
      '5 Excellent',
    ]);
  });

  it('US-RD-28 AC4: offers the complaint contact for a score of 1 or 2 only', () => {
    expect([1, 2, 3, 4, 5].map(offersComplaint)).toEqual([true, true, false, false, false]);
    expect(offersComplaint(0)).toBe(false);
  });

  it('shows an average from 3 ratings up (P-24)', () => {
    expect(RATING_RULES.minRatingsToShow).toBe(3);
  });
});
