import { getCurrentUser, guard, json } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = await guard('notification-read', 30, 900);
    if (blocked) return blocked;

    const user = await getCurrentUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const { id } = await params;
    if (!isUuid(id)) return json({ error: 'Notification not found.' }, 404);

    const { rows } = await pool.query<{ id: string; read_at: Date | null }>(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND user_id = $2
       RETURNING id, read_at`,
      [id, user.id],
    );
    if (!rows[0]) return json({ error: 'Notification not found.' }, 404);
    return json({ notification: { id: rows[0].id, readAt: rows[0].read_at?.toISOString() ?? null } });
  } catch (error) {
    console.error('Mark notification read failed:', error);
    return json({ error: 'Unable to update notification right now.' }, 500);
  }
}
