export function rideChatAvailable(ride, now) {
  if (ride.state !== 'scheduled') return true;
  if (ride.locked_at != null) return true;
  const lockAt = new Date(ride.departure_start.getTime() - 60 * 60 * 1000);
  return now.getTime() >= lockAt.getTime();
}

/** Shown to a suspended member who tries to post; they can still read the chat (FR-RD-01.5). */
export const SUSPENDED_CHAT_ERROR =
  'Your account is suspended, so you cannot post in pool chats. You can still read this chat, raise an SOS and file a complaint.';

/**
 * Whether `userId` is suspended at `now`, by the same rule as the active_rider_suspensions
 * view. A suspended rider's pool chat messages are refused (FR-RD-01.5).
 */
export async function senderSuspended(db, userId, now) {
  const { rows } = await db.query(
    `SELECT 1 FROM rider_suspensions
     WHERE user_id = $1 AND lifted_at IS NULL AND starts_at <= $2
       AND (ends_at IS NULL OR ends_at > $2)
     LIMIT 1`,
    [userId, now],
  );
  return rows.length > 0;
}

export function registerRideChatMessageHandler(io, socket, dependencies) {
  const { authenticate, isMember, createMessage } = dependencies;

  socket.on('ride:chat:message', async (payload, acknowledgement) => {
    const sendError = (code, error) => {
      const response = { ok: false, code, error };
      if (typeof acknowledgement === 'function') acknowledgement(response);
      socket.emit('ride:chat:error', { code, error });
    };
    const rideId = payload && typeof payload.rideId === 'string' ? payload.rideId : '';
    const message = payload && typeof payload.message === 'string' ? payload.message : '';
    if (!rideId || !message) {
      sendError('INVALID_MESSAGE', 'Message payload is invalid.');
      return;
    }

    try {
      const user = await authenticate(socket);
      if (!user || user.id !== socket.data.userId) {
        sendError('AUTHENTICATION_REQUIRED', 'Sign in again to send messages.');
        socket.disconnect(true);
        return;
      }
      const roomName = `ride:${rideId}`;
      if (!socket.rooms.has(roomName) || !(await isMember(rideId, user.id))) {
        sendError('FORBIDDEN', 'Only current pool members may post here.');
        socket.leave(roomName);
        return;
      }
      const recipients = [];
      for (const recipient of await io.in(roomName).fetchSockets()) {
        if (!(await isMember(rideId, recipient.data.userId))) {
          recipient.leave(roomName);
          continue;
        }
        if (recipient.id !== socket.id) recipients.push(recipient);
      }
      const result = await createMessage(rideId, user.id, message);
      if (!result.ok) {
        sendError(result.code, result.error);
        return;
      }
      const response = {
        ok: true,
        message: { ...result.message, senderName: socket.data.userName },
      };
      for (const recipient of recipients) {
        recipient.emit('ride:chat:message', {
          rideId,
          ...response.message,
          isMine: false,
        });
      }
      if (typeof acknowledgement === 'function') acknowledgement(response);
    } catch (error) {
      console.error('Ride chat message failed:', error);
      sendError('SAVE_FAILED', 'Message could not be saved. Try again.');
    }
  });
}
