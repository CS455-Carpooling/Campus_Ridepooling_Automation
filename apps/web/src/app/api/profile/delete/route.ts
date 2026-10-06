import { pool } from '@/lib/db';
import { destroySession, getCurrentUser, guard, hashPassword, json, newToken } from '@/lib/auth';

export async function POST(req: Request) {
  const blocked = await guard('profile-delete', 3, 3600);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  let confirmation: unknown;
  try {
    confirmation = (await req.json()).confirmation;
  } catch {
    return json({ error: 'Confirm account deletion to continue.' }, 400);
  }
  if (confirmation !== 'DELETE') {
    return json({ error: 'Confirm account deletion to continue.' }, 400);
  }

  const replacementPassword = await hashPassword(newToken());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users
       SET email = $1, full_name = 'Deleted user', roll_number = 'DELETED',
           password_hash = $2, email_verified_at = NULL
       WHERE id = $3`,
      [`deleted+${user.id}@iitk.ac.in`, replacementPassword, user.id],
    );
    await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    await client.query('DELETE FROM auth_tokens WHERE user_id = $1', [user.id]);
    await client.query('DELETE FROM user_profiles WHERE user_id = $1', [user.id]);
    await client.query('DELETE FROM rate_limits WHERE key = $1 OR key = $2', [
      `login:${user.email}`,
      `register:${user.email}`,
    ]);
    await client.query('COMMIT');
    await destroySession();
    return json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
