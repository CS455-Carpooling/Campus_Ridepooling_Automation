const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const NOTIFICATION_CHANNEL = 'notification_inserted';
const NOTIFICATION_EVENT = 'notification:new';

export function notificationRoom(userId) {
  return `notification:user:${userId}`;
}

/**
 * Join a notification room using only the authenticated user identity placed on the socket
 * by the server's session middleware. No client-provided ID or room name is accepted.
 */
export function joinAuthenticatedNotificationRoom(socket) {
  const userId = socket?.data?.userId;
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) return false;
  socket.join(notificationRoom(userId));
  return true;
}

function parseNotificationId(payload) {
  if (typeof payload !== 'string' || !UUID_PATTERN.test(payload)) return null;
  return payload;
}

function asIsoString(value) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Notification timestamp is invalid.');
  return date.toISOString();
}

export function serializeNotificationRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    relatedRideId: row.related_ride_id,
    relatedChatId: row.related_chat_id,
    relatedMessageId: row.related_message_id,
    readAt: row.read_at === null ? null : asIsoString(row.read_at),
    createdAt: asIsoString(row.created_at),
  };
}

/**
 * The LISTEN payload contains only an ID. Always reload the canonical database row and derive
 * the recipient room from that row; never trust a recipient supplied by a socket or payload.
 */
export function registerNotificationInsertHandler(io, { loadNotification, logger = console }) {
  return async function handleNotificationInsert(payload) {
    const notificationId = parseNotificationId(payload);
    if (!notificationId) return false;

    try {
      const row = await loadNotification(notificationId);
      if (!row || typeof row.user_id !== 'string' || !UUID_PATTERN.test(row.user_id)) {
        return false;
      }

      const notification = serializeNotificationRow(row);
      io.to(notificationRoom(row.user_id)).emit(NOTIFICATION_EVENT, notification);
      return true;
    } catch (error) {
      logger.error('Live notification delivery failed:', error);
      return false;
    }
  };
}
