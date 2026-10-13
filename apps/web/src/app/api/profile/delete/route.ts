import { pool } from '@/lib/db';
import { destroySession, getCurrentUser, guard, hashPassword, json, newToken } from '@/lib/auth';

// A ride counts until it has happened: under way, or scheduled with its window not over yet.
const ACTIVE_RIDES_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM riders seat
    JOIN rides r ON r.id = seat.ride_id
    WHERE seat.user_id = $1 AND seat.left_at IS NULL AND seat.no_show_at IS NULL
      AND (r.state IN ('pickup_in_progress', 'in_transit')
           OR (r.state = 'scheduled' AND r.departure_end > now()))
  ) OR EXISTS (
    SELECT 1 FROM ride_join_requests request
    WHERE request.rider_id = $1 AND request.status IN ('pending', 'needs_reconfirmation')
  ) AS busy`;

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Locked first, so no join request or ride can start while the account is checked.
    await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    // An account that others are relying on is not deleted from under them: a ride it offers
    // or holds a seat on that has not happened yet, or a request still waiting for an owner.
    const active = await client.query<{ busy: boolean }>(ACTIVE_RIDES_SQL, [user.id]);
    if (active.rows[0]?.busy) {
      await client.query('ROLLBACK');
      return json(
        {
          error:
            'Cancel or leave your upcoming rides and withdraw your waiting requests before deleting your account.',
          code: 'active_rides',
        },
        409,
      );
    }
    // Only now, once deletion will go ahead: the hash is deliberately slow.
    const replacementPassword = await hashPassword(newToken());
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
