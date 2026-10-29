import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import { consumeToken, guard, hashPassword, readJson, json } from '@/lib/auth';

export async function POST(req: Request) {
  const blocked = await guard('reset', 10, 3600);
  if (blocked) return blocked;

  const b = await readJson(req);
  const token = typeof b.token === 'string' ? b.token : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < 8 || password.length > 128)
    return json({ error: 'Password must be 8 to 128 characters.' }, 400);

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const userId = token ? await consumeToken(token, 'reset', client) : null;
    if (!userId) {
      await client.query('ROLLBACK');
      return json({ error: 'This reset link is invalid or has expired.' }, 400);
    }

    const hash = await hashPassword(password);
    const updated = await client.query(
      'UPDATE users SET password_hash=$1, email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$2',
      [hash, userId],
    );
    if (updated.rowCount !== 1) {
      throw new Error('Reset token referenced a missing user.');
    }
    await client.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
    await client.query('COMMIT');
    return json({ ok: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Password reset failed:', error);
    return json({ error: 'Unable to reset the password right now.' }, 500);
  } finally {
    client?.release();
  }
}
