import { pool } from '@/lib/db';
import { guard, getCurrentUser, json, readJson } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { getRideChatThread, reportChatMessage } from '@/lib/ride-chat';

async function isRideMember(rideId: string, userId: string) {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT owner_id AS user_id FROM rides WHERE id = $1
     UNION ALL
     SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL`,
    [rideId],
  );
  return rows.some((row) => row.user_id === userId);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const { id } = await params;
  if (!isUuid(id)) return json({ error: 'Ride not found.' }, 404);

  const thread = await getRideChatThread(id, user.id);
  if (!thread) {
    const ride = await pool.query<{
      id: string;
      state: string;
      completed_at: Date | null;
      cancelled_at: Date | null;
    }>('SELECT id, state, completed_at, cancelled_at FROM rides WHERE id = $1', [id]);
    if (ride.rows.length === 0) return json({ error: 'Ride not found.' }, 404);
    const member = await isRideMember(id, user.id);
    if (!member) return json({ error: 'Ride not found.' }, 404);
    const row = ride.rows[0];
    const completedAt = row.state === 'completed' ? row.completed_at : row.cancelled_at;
    if (completedAt && Date.now() >= completedAt.getTime() + 31 * 24 * 60 * 60 * 1000) {
      return json({ thread: null, message: 'The pool chat retention period has ended.' }, 200);
    }
    if (row.state === 'cancelled') {
      return json(
        { thread: null, message: 'No pool chat was opened for this cancelled ride.' },
        200,
      );
    }
    return json({ thread: null, message: 'Pool chat opens once the ride locks.' }, 200);
  }

  return json({ thread }, 200);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await guard('ride-chat', 20, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const { id } = await params;
  if (!isUuid(id)) return json({ error: 'Ride not found.' }, 404);

  const body = await readJson(req);
  const member = await isRideMember(id, user.id);
  if (!member) return json({ error: 'Ride not found.' }, 404);

  if (body.action === 'report') {
    const messageId = typeof body.messageId === 'string' ? body.messageId : null;
    if (!messageId) {
      return json({ error: 'A message ID is required to report a chat message.' }, 400);
    }

    const result = await reportChatMessage(
      id,
      user.id,
      messageId,
      typeof body.reason === 'string' ? body.reason : 'Other',
    );
    if (!result.ok) {
      return json({ error: result.error }, result.code === 'FORBIDDEN' ? 403 : 400);
    }

    return json({ reference: result.reference }, 200);
  }

  return json({ error: 'Send chat messages over the authenticated live connection.' }, 405);
}
