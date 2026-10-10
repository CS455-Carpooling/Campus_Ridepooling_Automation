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
