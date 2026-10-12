import { getCurrentUser, json } from '@/lib/auth';
import { pool } from '@/lib/db';

type NotificationRow = {
  id: string;
  type: 'pool_chat_opened' | 'pool_chat_message' | 'ride_update';
  title: string;
  body: string;
  related_ride_id: string | null;
  related_chat_id: string | null;
  related_message_id: string | null;
  read_at: Date | null;
  created_at: Date;
};

function integerParam(params: URLSearchParams, name: string, fallback: number, min: number, max: number) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function serialize(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    relatedRideId: row.related_ride_id,
    relatedChatId: row.related_chat_id,
    relatedMessageId: row.related_message_id,
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const params = new URL(req.url).searchParams;
    const limit = integerParam(params, 'limit', 20, 1, 100);
    const offset = integerParam(params, 'offset', 0, 0, 1_000_000);
    if (limit === null || offset === null) {
      return json({ error: 'Invalid pagination. limit must be 1-100 and offset 0-1000000.' }, 400);
    }

    const { rows } = await pool.query<NotificationRow>(
      `SELECT id, type, title, body, related_ride_id, related_chat_id,
              related_message_id, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit + 1, offset],
    );
    return json({
      notifications: rows.slice(0, limit).map(serialize),
      pagination: { limit, offset, hasMore: rows.length > limit },
    });
  } catch (error) {
    console.error('List notifications failed:', error);
    return json({ error: 'Unable to retrieve notifications right now.' }, 500);
  }
}
