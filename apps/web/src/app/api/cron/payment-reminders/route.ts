import { timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { json } from '@/lib/auth';
import { pool } from '@/lib/db';
import { sendDuePaymentReminders } from '@/lib/payment-settlement';

function authorized(req: Request): boolean {
  const secret = process.env.PAYMENT_REMINDER_CRON_SECRET;
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

/** Protected scheduler endpoint: invoke periodically with Authorization: Bearer <secret>. */
export async function POST(req: Request) {
  if (!process.env.PAYMENT_REMINDER_CRON_SECRET) {
    return json({ error: 'Payment reminder scheduler is not configured.' }, 503);
  }
  if (!authorized(req)) return json({ error: 'Unauthorized.' }, 401);
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const sent = await sendDuePaymentReminders(client, new Date());
    await client.query('COMMIT');
    return json({ processed: sent });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Payment reminder job failed:', error);
    return json({ error: 'Unable to process payment reminders.' }, 500);
  } finally {
    client?.release();
  }
}
