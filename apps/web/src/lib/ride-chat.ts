import 'server-only';
import { pool } from './db';
import { isUuid } from './ids';
import { lockTime, type RideState } from './ride-status';

export type RideChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  reported: boolean;
};

export type RideChatThread = {
  id: string;
  rideId: string;
  openedAt: string;
  readOnly: boolean;
  canWrite: boolean;
  messages: RideChatMessage[];
};

const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_MESSAGES_PER_MEMBER_PER_MINUTE = 20;

function asIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

type RideRow = {
  id: string;
  owner_id: string;
  state: RideState;
  departure_start: Date;
  completed_at: Date | null;
  cancelled_at: Date | null;
};

type ChatRow = {
  id: string;
  ride_id: string;
  opened_at: Date;
  closed_at: Date | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: Date;
  reported_at: Date | null;
  viewer_is_sender: boolean;
};

export function rideChatAvailable(
  ride: Pick<RideRow, 'state' | 'departure_start'>,
  now: Date,
): boolean {
  if (ride.state !== 'scheduled') return true;
  return now.getTime() >= lockTime(ride.departure_start).getTime();
}

export function rideChatReadOnly(
  ride: Pick<RideRow, 'state' | 'completed_at' | 'cancelled_at'>,
  now: Date,
): boolean {
  if (ride.state === 'completed' && ride.completed_at) {
    const closesAt = new Date(ride.completed_at.getTime() + 24 * 60 * 60 * 1000);
    return now.getTime() >= closesAt.getTime();
  }
  if (ride.state === 'cancelled' && ride.cancelled_at) {
    const closesAt = new Date(ride.cancelled_at.getTime() + 24 * 60 * 60 * 1000);
    return now.getTime() >= closesAt.getTime();
  }
  return false;
}

export function rideChatCanWrite(
  ride: Pick<RideRow, 'state' | 'completed_at' | 'cancelled_at'>,
  now: Date,
): boolean {
  if (ride.state === 'cancelled') return false;
  return !rideChatReadOnly(ride, now);
}

export function rideChatDeletionDue(
  ride: Pick<RideRow, 'state' | 'completed_at' | 'cancelled_at'>,
  now: Date,
): boolean {
  const completionTime =
    ride.state === 'completed'
      ? ride.completed_at
      : ride.state === 'cancelled'
        ? ride.cancelled_at
        : null;
  if (!completionTime) return false;
  const deleteAfter = new Date(
    completionTime.getTime() + 30 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000,
  );
  return now.getTime() >= deleteAfter.getTime();
}

async function memberIdsForRide(rideId: string) {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT owner_id AS user_id FROM rides WHERE id = $1
     UNION ALL
     SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL`,
    [rideId],
  );
  return rows.map((row) => row.user_id);
}

async function loadOrCreateChat(ride: RideRow, now: Date) {
  const existing = await pool.query<ChatRow>(
    'SELECT id, ride_id, opened_at, closed_at FROM ride_chats WHERE ride_id = $1',
    [ride.id],
  );
  if (existing.rows[0]) return existing.rows[0];
  if (!rideChatAvailable(ride, now) || ride.state === 'cancelled') return null;

  const created = await pool.query<ChatRow>(
    `WITH created AS (
       INSERT INTO ride_chats (ride_id, opened_at)
       VALUES ($1, $2)
       ON CONFLICT (ride_id) DO NOTHING
       RETURNING id, ride_id, opened_at, closed_at
     ),
     notified AS (
       INSERT INTO notifications
         (user_id, type, title, body, related_ride_id, related_chat_id, created_at)
       SELECT members.user_id, 'pool_chat_opened', 'Pool chat opened',
              'The ride is locked and the private pool chat is now open.',
              $1, created.id, $2
       FROM created
       CROSS JOIN (
         SELECT owner_id AS user_id FROM rides WHERE id = $1
         UNION
         SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL
       ) members
       RETURNING id
     )
     SELECT created.id, created.ride_id, created.opened_at, created.closed_at
     FROM created CROSS JOIN (SELECT count(*) FROM notified) notification_count`,
    [ride.id, now],
  );

  if (created.rows[0]) {
    return created.rows[0];
  }

  const retry = await pool.query<ChatRow>(
    'SELECT id, ride_id, opened_at, closed_at FROM ride_chats WHERE ride_id = $1',
    [ride.id],
  );
  return retry.rows[0] ?? null;
}

export async function getRideChatThread(
  rideId: string,
  viewerId: string,
  now: Date = new Date(),
): Promise<RideChatThread | null> {
  if (!isUuid(rideId) || !isUuid(viewerId)) return null;

  const rideQuery = await pool.query<RideRow>(
    `SELECT id, owner_id, state, departure_start, completed_at, cancelled_at
     FROM rides WHERE id = $1`,
    [rideId],
  );
  const ride = rideQuery.rows[0];
  if (!ride) return null;

  const memberIds = await memberIdsForRide(rideId);
  if (!memberIds.includes(viewerId)) return null;

  if (rideChatDeletionDue(ride, now)) {
    const deleted = await pool.query<{ id: string }>(
      `DELETE FROM ride_chats c
       WHERE c.ride_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM ride_chat_complaints complaint
           WHERE complaint.chat_id = c.id AND complaint.status = 'open'
         )`,
      [ride.id],
    );
    if (deleted.rows[0]) return null;
    const retained = await pool.query<{ id: string }>(
      'SELECT id FROM ride_chats WHERE ride_id = $1',
      [ride.id],
    );
    if (!retained.rows[0]) return null;
  }

  if (!rideChatAvailable(ride, now)) return null;

  const chat = await loadOrCreateChat(ride, now);
  if (!chat) return null;

  const messages = await pool.query<MessageRow>(
    `SELECT m.id,
            m.sender_id,
            COALESCE(profile.display_name, u.full_name) AS sender_name,
            m.body,
            m.created_at,
            m.reported_at,
            (m.sender_id = $2) AS viewer_is_sender
     FROM ride_chat_messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN user_profiles profile ON profile.user_id = u.id
     WHERE m.chat_id = $1
     ORDER BY m.created_at ASC`,
    [chat.id, viewerId],
  );

  return {
    id: chat.id,
    rideId: ride.id,
    openedAt: chat.opened_at.toISOString(),
    readOnly: rideChatReadOnly(ride, now),
    canWrite: rideChatCanWrite(ride, now),
    messages: messages.rows.map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      body: message.body,
      createdAt: asIsoString(message.created_at),
      isMine: message.viewer_is_sender,
      reported: message.reported_at !== null,
    })),
  };
}

export async function createChatMessage(
  rideId: string,
  senderId: string,
  rawMessage: string,
  now: Date = new Date(),
): Promise<{ ok: true; message: RideChatMessage } | { ok: false; code: string; error: string }> {
  const text = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (text.length === 0 || text.length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: 'INVALID_MESSAGE',
      error: `Message must be 1 to ${MAX_CHAT_MESSAGE_LENGTH} characters.`,
    };
  }

  if (!isUuid(rideId) || !isUuid(senderId)) {
    return { ok: false, code: 'INVALID_ID', error: 'The ride or sender ID is invalid.' };
  }

  const rate = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM ride_chat_messages
     WHERE sender_id = $1 AND created_at >= now() - interval '1 minute'`,
    [senderId],
  );
  if ((rate.rows[0]?.count ?? 0) >= MAX_MESSAGES_PER_MEMBER_PER_MINUTE) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      error: `Only ${MAX_MESSAGES_PER_MEMBER_PER_MINUTE} messages per minute are allowed per member.`,
    };
  }

  const rideQuery = await pool.query<RideRow>(
    `SELECT id, owner_id, state, departure_start, completed_at, cancelled_at
     FROM rides WHERE id = $1`,
    [rideId],
  );
  const ride = rideQuery.rows[0];
  if (!ride) {
    return { ok: false, code: 'NOT_FOUND', error: 'Ride not found.' };
  }

  const memberIds = await memberIdsForRide(rideId);
  if (!memberIds.includes(senderId)) {
    return { ok: false, code: 'FORBIDDEN', error: 'Only current pool members may post here.' };
  }

  if (!rideChatAvailable(ride, now)) {
    return { ok: false, code: 'CHAT_UNAVAILABLE', error: 'Pool chat opens once the ride locks.' };
  }

  if (!rideChatCanWrite(ride, now)) {
    return { ok: false, code: 'CHAT_READ_ONLY', error: 'This pool chat is read-only.' };
  }

  const chat = await loadOrCreateChat(ride, now);
  if (!chat) {
    return { ok: false, code: 'CHAT_UNAVAILABLE', error: 'Pool chat is not open yet.' };
  }

  const created = await pool.query<{
    id: string;
    sender_id: string;
    body: string;
    created_at: Date;
  }>(
    `INSERT INTO ride_chat_messages (chat_id, sender_id, body, created_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_id, body, created_at`,
    [chat.id, senderId, text, now],
  );
  const message = created.rows[0];
  if (!message) {
    return { ok: false, code: 'SAVE_FAILED', error: 'Message could not be saved.' };
  }

  const recipients = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM (
       SELECT owner_id AS user_id FROM rides WHERE id = $1
       UNION ALL
       SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL
     ) members
     WHERE user_id <> $2`,
    [rideId, senderId],
  );

  for (const recipient of recipients.rows) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, related_ride_id, related_chat_id, related_message_id, created_at)
       VALUES ($1, 'pool_chat_message', 'New ride chat message', $2, $3, $4, $5, $6)`,
      [
        recipient.user_id,
        `${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`,
        rideId,
        chat.id,
        message.id,
        now,
      ],
    );
  }

  const chatMessage: RideChatMessage = {
    id: message.id,
    senderId: senderId,
    senderName: 'You',
    body: message.body,
    createdAt: asIsoString(message.created_at),
    isMine: true,
    reported: false,
  };

  return { ok: true, message: chatMessage };
}

export async function reportChatMessage(
  rideId: string,
  reporterId: string,
  messageId: string,
  reason: string = 'Other',
  now: Date = new Date(),
): Promise<{ ok: true; reference: string } | { ok: false; code: string; error: string }> {
  if (!isUuid(rideId) || !isUuid(reporterId) || !isUuid(messageId)) {
    return { ok: false, code: 'INVALID_ID', error: 'The message or trip ID is invalid.' };
  }

  const rideQuery = await pool.query<RideRow>(
    `SELECT id, owner_id, state, departure_start, completed_at, cancelled_at
     FROM rides WHERE id = $1`,
    [rideId],
  );
  const ride = rideQuery.rows[0];
  if (!ride) {
    return { ok: false, code: 'NOT_FOUND', error: 'Ride not found.' };
  }

  const memberIds = await memberIdsForRide(rideId);
  if (!memberIds.includes(reporterId)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      error: 'Only current pool members may report messages.',
    };
  }

  const chat = await loadOrCreateChat(ride, now);
  if (!chat) {
    return { ok: false, code: 'CHAT_UNAVAILABLE', error: 'Pool chat is not open yet.' };
  }

  const normalizedReason = reason.trim().slice(0, 500) || 'Other';
  const result = await pool.query<{ reference: string }>(
    `WITH reported AS (
       UPDATE ride_chat_messages
       SET reported_at = $4, report_reason = $5
       WHERE id = $1 AND chat_id = $2 AND sender_id <> $3 AND reported_at IS NULL
       RETURNING id
     )
     INSERT INTO ride_chat_complaints
       (reference, ride_id, chat_id, message_id, reporter_id, reason, created_at)
     SELECT 'chat-' || left(id::text, 8), $6, $2, id, $3, $5, $4 FROM reported
     RETURNING reference`,
    [messageId, chat.id, reporterId, now, normalizedReason, rideId],
  );

  if (!result.rows[0]) {
    return { ok: false, code: 'REPORT_FAILED', error: 'This message could not be reported.' };
  }

  return { ok: true, reference: result.rows[0].reference };
}

export async function listOpenChatComplaints() {
  const { rows } = await pool.query<{
    reference: string;
    ride_id: string;
    message_id: string;
    reporter_name: string;
    sender_name: string;
    body: string;
    reason: string;
    created_at: Date;
  }>(
    `SELECT complaint.reference, complaint.ride_id, complaint.message_id,
            reporter.full_name AS reporter_name, sender.full_name AS sender_name,
            message.body, complaint.reason, complaint.created_at
     FROM ride_chat_complaints complaint
     JOIN ride_chat_messages message ON message.id = complaint.message_id
     JOIN users reporter ON reporter.id = complaint.reporter_id
     JOIN users sender ON sender.id = message.sender_id
     WHERE complaint.status = 'open'
     ORDER BY complaint.created_at ASC`,
  );
  return rows.map((row) => ({ ...row, created_at: asIsoString(row.created_at) }));
}

export async function resolveChatComplaint(reference: string) {
  const result = await pool.query(
    `UPDATE ride_chat_complaints
     SET status = 'resolved', resolved_at = now()
     WHERE reference = $1 AND status = 'open'
     RETURNING reference`,
    [reference],
  );
  return result.rows.length > 0;
}
