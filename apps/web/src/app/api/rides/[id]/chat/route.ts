import { pool } from '@/lib/db';
import { guard, getCurrentUser, json, readJson } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { createChatMessage, getRideChatThread, reportChatMessage } from '@/lib/ride-chat';

async function isRideMember(rideId: string, userId: string) {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT owner_id AS user_id FROM rides WHERE id = $1
     UNION ALL
     SELECT user_id FROM riders WHERE ride_id = $1`,
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
    const ride = await pool.query<{ id: string }>('SELECT id FROM rides WHERE id = $1', [id]);
    if (ride.rows.length === 0) return json({ error: 'Ride not found.' }, 404);
    const member = await isRideMember(id, user.id);
    if (!member) return json({ error: 'Ride not found.' }, 404);
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

  if (typeof body.message !== 'string') {
    return json({ error: 'A message is required.' }, 400);
  }

  const result = await createChatMessage(id, user.id, body.message);
  if (!result.ok) {
    const statusMap: Record<string, number> = {
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CHAT_READ_ONLY: 403,
      CHAT_UNAVAILABLE: 409,
      INVALID_MESSAGE: 400,
      INVALID_ID: 400,
      RATE_LIMITED: 429,
      SAVE_FAILED: 500,
    };
    return json({ error: result.error }, statusMap[result.code] ?? 400);
  }

  return json({ message: result.message }, 200);
}
