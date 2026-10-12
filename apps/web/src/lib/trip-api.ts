import 'server-only';
import type { PoolClient } from 'pg';
import { json } from './auth';
import { pool } from './db';
import type { TripResult } from './trip';

/**
 * Runs one trip change (CS455-62) in its own transaction and answers it: the change is committed
 * only when it is done, so a refusal or an error leaves nothing behind. Refusals come as
 * `{ error, code }`, 403 for someone who is not the owner and 409 otherwise; the grace period
 * adds `availableAt`. Errors are logged, never shown.
 */
export async function runTripChange<T>(
  label: string,
  messages: Record<string, string>,
  run: (client: PoolClient) => Promise<TripResult<T>>,
  body: (value: T) => object,
): Promise<Response> {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await run(client);
    await client.query(result.kind === 'done' ? 'COMMIT' : 'ROLLBACK');
    if (result.kind === 'done') return json(body(result.value));
    if (result.kind === 'not_found') {
      return json({ error: 'Ride not found.', code: 'not_found' }, 404);
    }
    if (result.kind === 'seat_not_found') {
      return json({ error: 'That person is not on this ride.', code: 'seat_not_found' }, 404);
    }
    return json(
      {
        error: messages[result.code] ?? 'This cannot be done now.',
        code: result.code,
        ...(result.availableAt ? { availableAt: result.availableAt } : {}),
      },
      result.code === 'not_owner' ? 403 : 409,
    );
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error(`${label} failed:`, error);
    return json({ error: 'Unable to update the trip right now.', code: 'server_error' }, 500);
  } finally {
    client?.release();
  }
}
