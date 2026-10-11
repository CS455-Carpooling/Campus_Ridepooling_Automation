import { describe, expect, it } from 'vitest';
import {
  enforcementMessages,
  parseReactivationRequest,
  parseSuspensionRequest,
  parseWarningRequest,
  suspendedMessage,
  suspensionEndsAt,
} from './enforcement-rules';

const COMPLAINT = 'C0C0C0C0-1111-4000-8000-000000000001';

describe('parseWarningRequest (OA-FR-21)', () => {
  it('takes a trimmed reason and an optional linked complaint', () => {
    expect(parseWarningRequest({ reason: '  Late twice  ', complaintId: COMPLAINT })).toEqual({
      ok: true,
      value: { reason: 'Late twice', complaintId: COMPLAINT.toLowerCase() },
    });
    expect(parseWarningRequest({ reason: 'Late' })).toEqual({
      ok: true,
      value: { reason: 'Late', complaintId: null },
    });
  });

  it.each([undefined, '', '   ', 42, 'x'.repeat(1001)])('requires a reason (%s)', (reason) => {
    expect(parseWarningRequest({ reason })).toEqual({
      ok: false,
      errors: { reason: enforcementMessages.reason },
    });
  });

  it('refuses a linked complaint that is not an ID, and a body that is not an object', () => {
    expect(parseWarningRequest({ reason: 'Late', complaintId: 'abc' })).toMatchObject({
      ok: false,
      errors: { complaintId: enforcementMessages.complaintId },
    });
    expect(parseWarningRequest(null)).toMatchObject({ ok: false });
  });
});

describe('parseSuspensionRequest (UC-OA-08)', () => {
  const base = { reasonCategory: 'safety', reason: 'Unsafe driving' };

  it('takes a number of days', () => {
    expect(parseSuspensionRequest({ ...base, days: 3 })).toEqual({
      ok: true,
      value: { ...base, days: 3, indefinite: false, complaintId: null },
    });
  });

  it('takes an explicit indefinite suspension', () => {
    expect(parseSuspensionRequest({ ...base, indefinite: true, complaintId: COMPLAINT })).toEqual({
      ok: true,
      value: { ...base, days: null, indefinite: true, complaintId: COMPLAINT.toLowerCase() },
    });
  });

  it.each([
    ['neither a length nor indefinite', {}],
    ['both a length and indefinite', { days: 3, indefinite: true }],
    ['0 days', { days: 0 }],
    ['part of a day', { days: 1.5 }],
    ['more than 10 years', { days: 3651 }],
    ['days as text', { days: '3' }],
  ])('refuses %s', (_, length) => {
    expect(parseSuspensionRequest({ ...base, ...length })).toEqual({
      ok: false,
      errors: { length: enforcementMessages.length },
    });
  });

  it('requires a known reason category and a reason', () => {
    expect(parseSuspensionRequest({ days: 3, reasonCategory: 'sos', reason: '' })).toEqual({
      ok: false,
      errors: {
        reasonCategory: enforcementMessages.reasonCategory,
        reason: enforcementMessages.reason,
      },
    });
  });

  it('refuses a linked complaint that is not an ID', () => {
    expect(parseSuspensionRequest({ ...base, days: 3, complaintId: 7 })).toMatchObject({
      ok: false,
      errors: { complaintId: enforcementMessages.complaintId },
    });
  });
});

describe('parseReactivationRequest (US-OA-14)', () => {
  it('requires a reason', () => {
    expect(parseReactivationRequest({ reason: ' Appeal accepted ' })).toEqual({
      ok: true,
      value: { reason: 'Appeal accepted' },
    });
    expect(parseReactivationRequest({})).toEqual({
      ok: false,
      errors: { reason: enforcementMessages.reason },
    });
  });
});

describe('suspensionEndsAt and suspendedMessage (FR-RD-01.5)', () => {
  it('ends a whole number of days later', () => {
    expect(suspensionEndsAt(new Date('2026-10-11T00:00:00Z'), 3).toISOString()).toBe(
      '2026-10-14T00:00:00.000Z',
    );
  });

  it('tells the rider until when and the category, never the reason text', () => {
    const timed = {
      id: 's1',
      reasonCategory: 'no_show' as const,
      startsAt: '2026-10-11T00:00:00.000Z',
      endsAt: '2026-10-14T03:30:00.000Z',
      isIndefinite: false,
    };
    expect(suspendedMessage(timed, 'offer a ride')).toBe(
      'Your account is suspended until Wed 14 Oct, 09:00 (IST) (reason: No-show), so you cannot offer a ride. You can still file a complaint.',
    );
    expect(suspendedMessage({ ...timed, endsAt: null, isIndefinite: true }, 'rate people')).toBe(
      'Your account is suspended until an operations admin lifts it (reason: No-show), so you cannot rate people. You can still file a complaint.',
    );
  });
});
