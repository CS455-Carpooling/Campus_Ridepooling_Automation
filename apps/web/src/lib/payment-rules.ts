export type PaymentMethod = 'upi' | 'cash';
export type PaymentStatus = 'due' | 'paid' | 'confirmed' | 'disputed';

export type PaymentInput = { method: PaymentMethod; reference: string | null };

export function parsePaymentInput(
  input: unknown,
): { ok: true; value: PaymentInput } | { ok: false } {
  if (!input || typeof input !== 'object') return { ok: false };
  const body = input as Record<string, unknown>;
  if (body.method !== 'upi' && body.method !== 'cash') return { ok: false };
  if (
    body.reference !== undefined &&
    body.reference !== null &&
    typeof body.reference !== 'string'
  ) {
    return { ok: false };
  }
  if (typeof body.reference === 'string' && body.reference.length > 50) return { ok: false };
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  return { ok: true, value: { method: body.method, reference: reference || null } };
}

export function reminderDueAt(completedAt: Date, hours: 24 | 72): Date {
  return new Date(completedAt.getTime() + hours * 60 * 60 * 1000);
}

export function isReminderDue(completedAt: Date, now: Date, hours: 24 | 72): boolean {
  return now.getTime() >= reminderDueAt(completedAt, hours).getTime();
}

export function isOverdueForJoining(completedAt: Date, now: Date): boolean {
  return now.getTime() > completedAt.getTime() + 7 * 24 * 60 * 60 * 1000;
}
