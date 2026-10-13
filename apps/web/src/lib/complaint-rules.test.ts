import { describe, expect, it } from 'vitest';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_RULES,
  COMPLAINT_STATUSES,
  canMoveComplaint,
  characterCount,
  complaintCategoryLabels,
  complaintFormClosesAt,
  complaintMessages,
  complaintStatusLabels,
  complaintStatusMessages,
  complaintWindow,
  complaintWindowStart,
  parseComplaintRequest,
  parseComplaintStatusChange,
} from './complaint-rules';

const SEAT = '2b0f1f8e-4c1a-4a43-9b51-0d7f2b7c9a10';
const MESSAGE = 'c5d1a3b2-7e44-4f0e-8a6c-3e9b1d2f4a77';
const completedAt = new Date('2026-10-10T08:05:00+05:30');
const DAY = 24 * 60 * 60 * 1000;

describe('complaint categories and statuses (FR-RD-13.1, 13.5)', () => {
  it('offers the rider categories, Safety first', () => {
    expect(COMPLAINT_CATEGORIES.map((category) => complaintCategoryLabels[category])).toEqual([
      'Safety',
      'Harassment',
      'Tardiness',
      'Payment',
      'No-show',
      'Other',
    ]);
  });

  it('names the three statuses a rider sees', () => {
    expect(COMPLAINT_STATUSES.map((status) => complaintStatusLabels[status])).toEqual([
      'Submitted',
      'Under review',
      'Resolved',
    ]);
  });

  it('P-17: 7 days, 20 to 2000 characters, 5 a day', () => {
    expect(COMPLAINT_RULES).toEqual({
      filingDays: 7,
      minDescription: 20,
      maxDescription: 2000,
      maxPerDay: 5,
    });
  });
});

describe('complaintWindow (FR-RD-13.1)', () => {
  it('is open from completion until just before 7 days, and closed from then on', () => {
    expect(complaintFormClosesAt(completedAt)).toEqual(new Date(completedAt.getTime() + 7 * DAY));
    expect(complaintWindow('completed', completedAt, completedAt)).toBe('open');
    expect(
      complaintWindow('completed', completedAt, new Date(completedAt.getTime() + 7 * DAY - 1)),
    ).toBe('open');
    expect(
      complaintWindow('completed', completedAt, new Date(completedAt.getTime() + 7 * DAY)),
    ).toBe('closed');
  });

  it.each(['scheduled', 'pickup_in_progress', 'in_transit'] as const)(
    'is not open on a %s ride',
    (state) => {
      expect(complaintWindow(state, null, completedAt)).toBe('not_completed');
    },
  );

  it('is never open on a cancelled ride, nor on a completed one without a completion time', () => {
    expect(complaintWindow('cancelled', null, completedAt)).toBe('cancelled');
    expect(complaintWindow('completed', null, completedAt)).toBe('not_completed');
  });

  it('opens for a no-show from the no-show, during the trip, so they can dispute it (CS455-62)', () => {
    const noShowAt = new Date(completedAt.getTime() - 2 * 60 * 60 * 1000);
    expect(complaintWindow('pickup_in_progress', null, noShowAt, noShowAt)).toBe('open');
    expect(
      complaintWindow('in_transit', null, new Date(noShowAt.getTime() + 7 * DAY), noShowAt),
    ).toBe('closed');
    expect(complaintWindow('cancelled', null, noShowAt, noShowAt)).toBe('cancelled');
  });

  it('counts 7 days from the later of completion and the no-show', () => {
    const noShowAt = new Date(completedAt.getTime() - 60 * 60 * 1000);
    expect(complaintWindowStart(completedAt, noShowAt)).toEqual(completedAt);
    expect(complaintWindowStart(noShowAt, completedAt)).toEqual(completedAt);
    expect(complaintWindowStart(null, noShowAt)).toEqual(noShowAt);
    expect(complaintWindowStart(completedAt)).toEqual(completedAt);
    expect(complaintWindowStart(null, null)).toBeNull();
    // A completion time on a ride not completed does not count.
    expect(complaintWindow('in_transit', completedAt, completedAt, null)).toBe('not_completed');
  });
});

describe('parseComplaintRequest', () => {
  const valid = {
    occupantId: SEAT,
    category: 'payment',
    description: '  Did not pay their share of the fare.  ',
  };

  it('accepts a complaint, trimming the text, with or without a reported message', () => {
    expect(parseComplaintRequest(valid)).toEqual({
      ok: true,
      value: {
        occupantId: SEAT,
        category: 'payment',
        description: 'Did not pay their share of the fare.',
        messageId: null,
      },
    });
    expect(
      parseComplaintRequest({
        ...valid,
        occupantId: SEAT.toUpperCase(),
        messageId: MESSAGE.toUpperCase(),
      }),
    ).toMatchObject({ ok: true, value: { occupantId: SEAT, messageId: MESSAGE } });
  });

  it('names every field that is wrong at once', () => {
    expect(
      parseComplaintRequest({
        occupantId: 'seat',
        category: 'sos',
        description: 'short',
        messageId: 7,
      }),
    ).toEqual({
      ok: false,
      errors: {
        occupantId: complaintMessages.occupantId,
        category: complaintMessages.category,
        description: complaintMessages.description,
        messageId: complaintMessages.messageId,
      },
    });
    expect(parseComplaintRequest(undefined)).toMatchObject({ ok: false });
    expect(parseComplaintRequest([valid])).toMatchObject({ ok: false });
  });

  it('P-17: allows 20 to 2000 characters, counting an emoji once, after trimming', () => {
    const at = (description: string) => parseComplaintRequest({ ...valid, description });
    expect(at('a'.repeat(19)).ok).toBe(false);
    expect(at(`  ${'a'.repeat(19)}  `).ok).toBe(false);
    expect(at('a'.repeat(20)).ok).toBe(true);
    expect(at('a'.repeat(2000)).ok).toBe(true);
    expect(at('\u{1F697}'.repeat(2000)).ok).toBe(true);
    expect(at('a'.repeat(2001)).ok).toBe(false);
    expect(characterCount('\u{1F697}ok')).toBe(3);
  });
});

describe('parseComplaintStatusChange (OA-FR-18, FR-RD-13.5)', () => {
  it('moves a complaint under review, with an optional note', () => {
    expect(parseComplaintStatusChange({ status: 'under_review', version: 1 })).toEqual({
      ok: true,
      value: { status: 'under_review', version: 1 },
    });
    expect(
      parseComplaintStatusChange({ status: 'under_review', note: '  Called both.  ', version: 2 }),
    ).toEqual({ ok: true, value: { status: 'under_review', note: 'Called both.', version: 2 } });
  });

  it('resolves only with whether action was taken', () => {
    expect(
      parseComplaintStatusChange({ status: 'resolved', actionTaken: false, version: 3 }),
    ).toEqual({
      ok: true,
      value: { status: 'resolved', actionTaken: false, version: 3 },
    });
    expect(parseComplaintStatusChange({ status: 'resolved', version: 3 })).toEqual({
      ok: false,
      errors: { actionTaken: complaintStatusMessages.actionTaken },
    });
  });

  it('refuses another status, a long or non-text note, and a missing version', () => {
    expect(
      parseComplaintStatusChange({ status: 'submitted', note: 'x'.repeat(1001), version: 0 }),
    ).toEqual({
      ok: false,
      errors: {
        status: complaintStatusMessages.status,
        note: complaintStatusMessages.note,
        version: complaintStatusMessages.version,
      },
    });
    expect(
      parseComplaintStatusChange({ status: 'under_review', note: 5, version: 1 }),
    ).toMatchObject({
      ok: false,
      errors: { note: complaintStatusMessages.note },
    });
    expect(parseComplaintStatusChange('nonsense')).toMatchObject({ ok: false });
  });
});

describe('canMoveComplaint', () => {
  it('goes forward only, and Resolved is final', () => {
    expect(canMoveComplaint('submitted', 'under_review')).toBe(true);
    expect(canMoveComplaint('submitted', 'resolved')).toBe(true);
    expect(canMoveComplaint('under_review', 'resolved')).toBe(true);
    expect(canMoveComplaint('under_review', 'under_review')).toBe(false);
    expect(canMoveComplaint('under_review', 'submitted')).toBe(false);
    expect(canMoveComplaint('resolved', 'under_review')).toBe(false);
  });
});
