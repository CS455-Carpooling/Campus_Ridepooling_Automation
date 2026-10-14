import { getCurrentUser, guard, json } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';

export async function POST(req: Request, ctx: RouteContext<'/api/warnings/[id]/acknowledge'>) {
  try {
    const blocked = await guard('warning-acknowledgement', 20, 900);
    if (blocked) return blocked;
    const user = await getCurrentUser({
      allowIncompleteProfile: true,
      allowUnacknowledgedWarnings: true,
    });
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const { id } = await ctx.params;
    if (!isUuid(id)) return json({ error: 'Warning not found.' }, 404);

    const updated = await pool.query<{ id: string }>(
      `UPDATE rider_warnings
       SET acknowledged_at = now()
       WHERE id = $1 AND user_id = $2 AND acknowledged_at IS NULL
       RETURNING id`,
      [id, user.id],
    );
    if (updated.rows[0]) return json({ acknowledged: true });

    const existing = await pool.query<{ acknowledged: boolean }>(
      `SELECT acknowledged_at IS NOT NULL AS acknowledged
       FROM rider_warnings WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (!existing.rows[0]) return json({ error: 'Warning not found.' }, 404);
    if (existing.rows[0].acknowledged) return json({ acknowledged: true });
    return json({ error: 'Unable to acknowledge this warning right now.' }, 409);
  } catch (error) {
    console.error('Acknowledge rider warning failed:', error);
    return json({ error: 'Unable to acknowledge this warning right now.' }, 500);
  }
}
