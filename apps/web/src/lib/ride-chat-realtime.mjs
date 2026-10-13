import { activeSuspension, suspensionRefusal } from './suspension-rule.mjs';

export function rideChatAvailable(ride, now) {
  if (ride.state !== 'scheduled') return true;
  if (ride.locked_at != null) return true;
  const lockAt = new Date(ride.departure_start.getTime() - 60 * 60 * 1000);
  return now.getTime() >= lockAt.getTime();
}

/**
 * A pool chat (aliased `chat`) is kept past its 30 days while an unresolved complaint refers to
 * it (FR-RD-09.5): an open chat report, or a complaint that is not resolved and cites one of its
 * messages, whether reported from the chat or filed from the form with a message. A complaint
 * that cites no message does not keep the chat. Indexed through ride_chat_messages(chat_id) and
 * complaint_chat_messages(message_id).
 */
export const CHAT_KEPT_FOR_COMPLAINT_SQL = `(
  EXISTS (SELECT 1 FROM ride_chat_complaints report
          WHERE report.chat_id = chat.id AND report.status = 'open')
  OR EXISTS (SELECT 1 FROM ride_chat_messages message
             JOIN complaint_chat_messages cited ON cited.message_id = message.id
             JOIN complaints complaint ON complaint.id = cited.complaint_id
             WHERE message.chat_id = chat.id AND complaint.status <> 'resolved')
)`;

/**
 * Why `senderId` may not post in this ride's pool chat at `now`, as the refusal to send back, or
 * null. A suspended rider's messages are refused (FR-RD-01.5), with until when and why. The
 * ride's owner is not refused: their existing ride keeps running, like its trip actions, and its
 * riders rely on the chat to coordinate pickup. Both send paths use this (server.mjs, ride-chat.ts).
 *
 * @returns {Promise<{ ok: false, code: 'SUSPENDED', error: string } | null>}
 */
export async function chatSendRefusal(db, ride, senderId, now) {
  if (senderId === ride.owner_id) return null;
  const suspension = await activeSuspension(db, senderId, now);
  if (!suspension) return null;
  return {
    ok: false,
    code: 'SUSPENDED',
    error: suspensionRefusal(suspension, 'post in pool chats'),
  };
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
