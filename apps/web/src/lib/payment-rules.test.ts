import { describe, expect, it } from 'vitest';
import { isOverdueForJoining, isReminderDue, parsePaymentInput } from './payment-rules';

describe('payment settlement rules', () => {
  it('accepts cash/UPI and a trimmed optional reference up to 50 characters', () => {
    expect(parsePaymentInput({ method: 'upi', reference: '  UPI-123 ' })).toEqual({
      ok: true,
      value: { method: 'upi', reference: 'UPI-123' },
    });
    expect(parsePaymentInput({ method: 'cash' })).toEqual({
      ok: true,
      value: { method: 'cash', reference: null },
    });
    expect(parsePaymentInput({ method: 'cash', reference: 'x'.repeat(50) }).ok).toBe(true);
    expect(parsePaymentInput({ method: 'cash', reference: ' '.repeat(51) }).ok).toBe(false);
  });

  it('rejects unsupported methods, malformed references and references over 50 characters', () => {
    expect(parsePaymentInput({ method: 'card' }).ok).toBe(false);
    expect(parsePaymentInput({ method: 'upi', reference: 123 }).ok).toBe(false);
    expect(parsePaymentInput({ method: 'upi', reference: 'x'.repeat(51) }).ok).toBe(false);
  });

  it('sets reminders at 24 and 72 hours and blocks joining only after seven days', () => {
    const completed = new Date('2026-01-01T00:00:00.000Z');
    expect(isReminderDue(completed, new Date('2026-01-02T00:00:00.000Z'), 24)).toBe(true);
    expect(isReminderDue(completed, new Date('2026-01-03T23:59:59.000Z'), 72)).toBe(false);
    expect(isReminderDue(completed, new Date('2026-01-04T00:00:00.000Z'), 72)).toBe(true);
    expect(isOverdueForJoining(completed, new Date('2026-01-08T00:00:00.000Z'))).toBe(false);
    expect(isOverdueForJoining(completed, new Date('2026-01-08T00:00:00.001Z'))).toBe(true);
  });
});
