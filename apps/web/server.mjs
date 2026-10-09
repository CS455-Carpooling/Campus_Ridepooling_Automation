import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { parse } from 'node:url';
import { Pool } from 'pg';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);
const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_MESSAGES_PER_MEMBER_PER_MINUTE = 20;
const normalized = typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL.trim() : '';
const databaseUrl = /^postgres(?:ql)?:\/\//i.test(normalized) ? normalized : undefined;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('.render.com') ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const idx = item.indexOf('=');
        return idx === -1 ? [item, ''] : [item.slice(0, idx), decodeURIComponent(item.slice(idx + 1))];
      }),
  );
}

async function getSessionUser(cookieHeader = '') {
  const cookie = parseCookies(cookieHeader);
  const token = cookie['crp_session'] || cookie['__Host-crp_session'];
  if (!token) return null;

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hash],
  );

  return rows[0] ?? null;
}

async function isRideMember(rideId, userId) {
  const { rows } = await pool.query(
    `SELECT owner_id AS user_id FROM rides WHERE id = $1
     UNION ALL
     SELECT user_id FROM riders WHERE ride_id = $1`,
    [rideId],
  );
  return rows.some((row) => row.user_id === userId);
}

function rideChatAvailable(ride, now) {
  if (ride.state !== 'scheduled') return true;
  const lockAt = new Date(ride.departure_start.getTime() - 60 * 60 * 1000);
  return now.getTime() >= lockAt.getTime();
}

function rideChatReadOnly(ride, now) {
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

async function loadOrCreateChat(ride, now) {
  if (!rideChatAvailable(ride, now)) return null;

  const existing = await pool.query(
    'SELECT id, ride_id, opened_at, closed_at FROM ride_chats WHERE ride_id = $1',
    [ride.id],
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await pool.query(
    `INSERT INTO ride_chats (ride_id, opened_at)
     VALUES ($1, $2)
     ON CONFLICT (ride_id) DO NOTHING
     RETURNING id, ride_id, opened_at, closed_at`,
    [ride.id, now],
  );

  if (created.rows[0]) return created.rows[0];

  const retry = await pool.query(
    'SELECT id, ride_id, opened_at, closed_at FROM ride_chats WHERE ride_id = $1',
    [ride.id],
  );
  return retry.rows[0] ?? null;
}

async function createChatMessageForSocket(rideId, senderId, rawMessage, now = new Date()) {
  const text = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (text.length === 0 || text.length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: 'INVALID_MESSAGE',
      error: `Message must be 1 to ${MAX_CHAT_MESSAGE_LENGTH} characters.`,
    };
  }

  const rate = await pool.query(
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

  const rideQuery = await pool.query(
    `SELECT id, owner_id, state, departure_start, completed_at, cancelled_at
     FROM rides WHERE id = $1`,
    [rideId],
  );
  const ride = rideQuery.rows[0];
  if (!ride) return { ok: false, code: 'NOT_FOUND', error: 'Ride not found.' };

  const isMember = await isRideMember(rideId, senderId);
  if (!isMember) {
    return { ok: false, code: 'FORBIDDEN', error: 'Only current pool members may post here.' };
  }

  if (!rideChatAvailable(ride, now)) {
    return { ok: false, code: 'CHAT_UNAVAILABLE', error: 'Pool chat opens once the ride locks.' };
  }

  if (rideChatReadOnly(ride, now)) {
    return { ok: false, code: 'CHAT_READ_ONLY', error: 'This pool chat is read-only.' };
  }

  const chat = await loadOrCreateChat(ride, now);
  if (!chat) {
    return { ok: false, code: 'CHAT_UNAVAILABLE', error: 'Pool chat is not open yet.' };
  }

  const created = await pool.query(
    `INSERT INTO ride_chat_messages (chat_id, sender_id, body, created_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_id, body, created_at`,
    [chat.id, senderId, text, now],
  );
  const message = created.rows[0];
  if (!message) return { ok: false, code: 'SAVE_FAILED', error: 'Message could not be saved.' };

  const recipients = await pool.query(
    `SELECT user_id FROM (
       SELECT owner_id AS user_id FROM rides WHERE id = $1
       UNION ALL
       SELECT user_id FROM riders WHERE ride_id = $1
     ) members
     WHERE user_id <> $2`,
    [rideId, senderId],
  );

  for (const recipient of recipients.rows) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, related_ride_id, related_chat_id, related_message_id, created_at)
       VALUES ($1, 'pool_chat_message', 'New ride chat message', $2, $3, $4, $5, $6)`,
      [recipient.user_id, `${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`, rideId, chat.id, message.id, now],
    );
  }

  return {
    ok: true,
    message: {
      id: message.id,
      senderId,
      senderName: 'You',
      body: message.body,
      createdAt: message.created_at.toISOString(),
      isMine: true,
      reported: false,
    },
  };
}

async function reportChatMessageForSocket(rideId, reporterId, messageId, reason = 'Other', now = new Date()) {
  const rideQuery = await pool.query(
    `SELECT id, owner_id, state, departure_start, completed_at, cancelled_at
     FROM rides WHERE id = $1`,
    [rideId],
  );
  const ride = rideQuery.rows[0];
  if (!ride) return { ok: false, code: 'NOT_FOUND', error: 'Ride not found.' };

  if (!(await isRideMember(rideId, reporterId))) {
    return { ok: false, code: 'FORBIDDEN', error: 'Only current pool members may report messages.' };
  }

  const chat = await loadOrCreateChat(ride, now);
  if (!chat) return { ok: false, code: 'CHAT_UNAVAILABLE', error: 'Pool chat is not open yet.' };

  const result = await pool.query(
    `UPDATE ride_chat_messages
     SET reported_at = $4,
         report_reason = $5
     WHERE id = $1 AND chat_id = $2 AND sender_id <> $3 AND reported_at IS NULL
     RETURNING id`,
    [messageId, chat.id, reporterId, now, reason.trim() || 'Other'],
  );

  if (result.rows.length === 0) {
    return { ok: false, code: 'REPORT_FAILED', error: 'This message could not be reported.' };
  }

  return { ok: true, reference: `chat-${messageId.slice(0, 8)}` };
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    const user = await getSessionUser(socket.handshake.headers.cookie ?? '');
    if (!user) {
      return next(new Error('Authentication required.'));
    }
    socket.data.userId = user.id;
    socket.data.userName = user.full_name || 'Rider';
    next();
  });

  io.on('connection', (socket) => {
    socket.on('ride:chat:join', async ({ rideId }) => {
      if (typeof rideId !== 'string' || !rideId) {
        socket.emit('ride:chat:error', { code: 'INVALID_ID', error: 'A valid ride ID is required.' });
        return;
      }

      const member = await isRideMember(rideId, socket.data.userId);
      if (!member) {
        socket.emit('ride:chat:error', { code: 'FORBIDDEN', error: 'Only current pool members may join this chat.' });
        return;
      }

      socket.data.rideId = rideId;
      socket.join(`ride:${rideId}`);
      socket.emit('ride:chat:joined', { rideId });
    });

    socket.on('ride:chat:leave', ({ rideId }) => {
      if (typeof rideId === 'string' && rideId) {
        socket.leave(`ride:${rideId}`);
      }
    });

    socket.on('ride:chat:message', async ({ rideId, message }) => {
      if (typeof rideId !== 'string' || typeof message !== 'string') {
        socket.emit('ride:chat:error', { code: 'INVALID_MESSAGE', error: 'Message payload is invalid.' });
        return;
      }

      const member = await isRideMember(rideId, socket.data.userId);
      if (!member) {
        socket.emit('ride:chat:error', { code: 'FORBIDDEN', error: 'Only current pool members may post here.' });
        return;
      }

      const result = await createChatMessageForSocket(rideId, socket.data.userId, message, new Date());
      if (!result.ok) {
        socket.emit('ride:chat:error', { code: result.code, error: result.error });
        return;
      }

      io.to(`ride:${rideId}`).emit('ride:chat:message', {
        rideId,
        id: result.message.id,
        senderId: result.message.senderId,
        senderName: socket.data.userName,
        body: result.message.body,
        createdAt: result.message.createdAt,
        isMine: false,
        reported: false,
      });
    });

    socket.on('ride:chat:report', async ({ rideId, messageId, reason }) => {
      if (typeof rideId !== 'string' || typeof messageId !== 'string') {
        socket.emit('ride:chat:error', { code: 'INVALID_ID', error: 'A valid ride and message ID are required.' });
        return;
      }

      const userId = socket.data.userId;
      const result = await reportChatMessageForSocket(rideId, userId, messageId, typeof reason === 'string' ? reason : 'Other', new Date());
      if (!result.ok) {
        socket.emit('ride:chat:error', { code: result.code, error: result.error });
        return;
      }

      io.to(`ride:${rideId}`).emit('ride:chat:report', {
        rideId,
        reporterId: userId,
        messageId,
        reference: result.reference,
      });
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port} (${dev ? 'dev' : 'prod'})`);
  });
});
