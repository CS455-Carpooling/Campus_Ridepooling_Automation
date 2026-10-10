import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { parse } from 'node:url';
import { Pool } from 'pg';
import next from 'next';
import { Server } from 'socket.io';
import { registerRideChatMessageHandler } from './src/lib/ride-chat-realtime.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);
const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_MESSAGES_PER_MEMBER_PER_MINUTE = 20;
const normalized =
  typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL.trim() : '';
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
        return idx === -1
          ? [item, '']
          : [item.slice(0, idx), decodeURIComponent(item.slice(idx + 1))];
      }),
  );
}

async function getSessionUser(cookieHeader = '') {
  const cookie = parseCookies(cookieHeader);
  const token = cookie['crp_session'] || cookie['__Host-crp_session'];
  if (!token) return null;

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await pool.query(
    `SELECT u.id, COALESCE(NULLIF(profile.display_name, ''), u.full_name) AS display_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN user_profiles profile ON profile.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hash],
  );

  return rows[0] ?? null;
}

async function isRideMember(rideId, userId) {
  const { rows } = await pool.query(
    `SELECT owner_id AS user_id FROM rides WHERE id = $1
     UNION ALL
     SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL`,
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

function rideChatCanWrite(ride, now) {
  return ride.state !== 'cancelled' && !rideChatReadOnly(ride, now);
}

async function loadOrCreateChat(ride, now) {
  const existing = await pool.query(
    'SELECT id, ride_id, opened_at, closed_at FROM ride_chats WHERE ride_id = $1',
    [ride.id],
  );
  if (existing.rows[0]) return existing.rows[0];
  if (!rideChatAvailable(ride, now) || ride.state === 'cancelled') return null;

  const created = await pool.query(
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

  if (!rideChatCanWrite(ride, now)) {
    return { ok: false, code: 'CHAT_READ_ONLY', error: 'This pool chat is read-only.' };
  }

  const rate = await pool.query(
    `INSERT INTO ride_chat_message_limits (user_id, window_started_at, message_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id) DO UPDATE
       SET window_started_at = CASE
             WHEN ride_chat_message_limits.window_started_at <= $2 - interval '1 minute'
             THEN $2 ELSE ride_chat_message_limits.window_started_at END,
           message_count = CASE
             WHEN ride_chat_message_limits.window_started_at <= $2 - interval '1 minute'
             THEN 1 ELSE ride_chat_message_limits.message_count + 1 END
       WHERE ride_chat_message_limits.window_started_at <= $2 - interval '1 minute'
          OR ride_chat_message_limits.message_count < $3
     RETURNING message_count`,
    [senderId, now, MAX_MESSAGES_PER_MEMBER_PER_MINUTE],
  );
  if (!rate.rows[0]) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      error: `Only ${MAX_MESSAGES_PER_MEMBER_PER_MINUTE} messages per minute are allowed per member.`,
    };
  }

  const chat = await loadOrCreateChat(ride, now);
  if (!chat) {
    return { ok: false, code: 'CHAT_UNAVAILABLE', error: 'Pool chat is not open yet.' };
  }

  const client = await pool.connect();
  let message;
  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO ride_chat_messages (chat_id, sender_id, body, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, body, created_at`,
      [chat.id, senderId, text, now],
    );
    message = created.rows[0];
    if (!message) throw new Error('Chat message insert returned no row.');
    await client.query(
      `INSERT INTO notifications
         (user_id, type, title, body, related_ride_id, related_chat_id, related_message_id, created_at)
       SELECT members.user_id, 'pool_chat_message', 'New ride chat message', $2, $3, $4, $5, $6
       FROM (
         SELECT owner_id AS user_id FROM rides WHERE id = $3
         UNION
         SELECT user_id FROM riders WHERE ride_id = $3 AND left_at IS NULL
       ) members
       WHERE members.user_id <> $1`,
      [
        senderId,
        `${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`,
        rideId,
        chat.id,
        message.id,
        now,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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

  const emitToCurrentMembers = async (rideId, event, payload) => {
    for (const recipient of await io.in(`ride:${rideId}`).fetchSockets()) {
      if (!(await isRideMember(rideId, recipient.data.userId))) {
        recipient.leave(`ride:${rideId}`);
        continue;
      }
      recipient.emit(event, payload);
    }
  };

  io.use(async (socket, next) => {
    try {
      const user = await getSessionUser(socket.handshake.headers.cookie ?? '');
      if (!user) {
        return next(new Error('Authentication required.'));
      }
      socket.data.userId = user.id;
      socket.data.userName = user.display_name || 'Rider';
      next();
    } catch (error) {
      console.error('Ride chat authentication failed:', error);
      next(new Error('Authentication could not be verified.'));
    }
  });

  const openChatForLockedRide = async (ride) => {
    const created = await pool.query(
      `WITH created AS (
         INSERT INTO ride_chats (ride_id, opened_at)
         VALUES ($1, now())
         ON CONFLICT (ride_id) DO NOTHING
         RETURNING id
       ),
       notified AS (
         INSERT INTO notifications
           (user_id, type, title, body, related_ride_id, related_chat_id)
         SELECT members.user_id, 'pool_chat_opened', 'Pool chat opened',
                'The ride is locked and the private pool chat is now open.',
                $1, created.id
         FROM created
         CROSS JOIN (
           SELECT owner_id AS user_id FROM rides WHERE id = $1
           UNION
           SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL
         ) members
         RETURNING id
       )
       SELECT created.id
       FROM created CROSS JOIN (SELECT count(*) FROM notified) notification_count`,
      [ride.id],
    );
    if (!created.rows[0]) return;
    await emitToCurrentMembers(ride.id, 'ride:chat:opened', { rideId: ride.id });
  };

  const runChatMaintenance = async () => {
    try {
      const lockedRides = await pool.query(
        `SELECT id, state, departure_start, completed_at, cancelled_at
         FROM rides
        WHERE (
            (state = 'scheduled' AND departure_start <= now() + interval '1 hour')
            OR state IN ('pickup_in_progress', 'in_transit')
            OR (state = 'completed'
              AND completed_at >= now() - interval '24 hours')
            OR (state = 'cancelled'
              AND cancelled_at >= departure_start - interval '1 hour'
              AND cancelled_at >= now() - interval '31 days')
          )
          AND NOT EXISTS (SELECT 1 FROM ride_chats WHERE ride_id = rides.id)`,
      );
      for (const ride of lockedRides.rows) await openChatForLockedRide(ride);

      const closedChats = await pool.query(
        `UPDATE ride_chats chat
         SET closed_at = CASE
               WHEN ride.state = 'cancelled' THEN COALESCE(chat.closed_at, ride.cancelled_at, now())
               ELSE ride.completed_at + interval '24 hours'
             END,
             read_only_at = CASE
               WHEN ride.state = 'completed' THEN ride.completed_at + interval '24 hours'
               WHEN ride.state = 'cancelled'
                 AND ride.cancelled_at <= now() - interval '24 hours' THEN now()
               ELSE chat.read_only_at
             END
         FROM rides ride
         WHERE ride.id = chat.ride_id
           AND ((ride.state = 'cancelled' AND chat.closed_at IS NULL)
             OR (ride.state = 'cancelled' AND chat.read_only_at IS NULL
               AND ride.cancelled_at <= now() - interval '24 hours')
             OR (ride.state = 'completed'
               AND chat.read_only_at IS NULL
               AND ride.completed_at <= now() - interval '24 hours'))
         RETURNING chat.ride_id, (chat.read_only_at IS NOT NULL) AS read_only`,
      );
      for (const chat of closedChats.rows) {
        await emitToCurrentMembers(chat.ride_id, 'ride:chat:closed', {
          rideId: chat.ride_id,
          readOnly: chat.read_only,
        });
      }

      await pool.query(
        `DELETE FROM ride_chats chat
         USING rides ride
         WHERE ride.id = chat.ride_id
           AND ((ride.state = 'completed' AND ride.completed_at <= now() - interval '31 days')
             OR (ride.state = 'cancelled' AND ride.cancelled_at <= now() - interval '31 days'))
           AND NOT EXISTS (
             SELECT 1 FROM ride_chat_complaints complaint
             WHERE complaint.chat_id = chat.id AND complaint.status = 'open'
           )`,
      );
    } catch (error) {
      console.error('Ride chat maintenance failed:', error);
    }
  };

  io.on('connection', (socket) => {
    const sessionCheck = setInterval(async () => {
      try {
        const user = await getSessionUser(socket.handshake.headers.cookie ?? '');
        if (!user || user.id !== socket.data.userId) socket.disconnect(true);
      } catch (error) {
        console.error('Ride chat session revalidation failed:', error);
        socket.disconnect(true);
      }
    }, 15_000);
    socket.on('disconnect', () => clearInterval(sessionCheck));

    socket.on('ride:chat:join', async (payload) => {
      const rideId = payload && typeof payload.rideId === 'string' ? payload.rideId : '';
      if (typeof rideId !== 'string' || !rideId) {
        socket.emit('ride:chat:error', {
          code: 'INVALID_ID',
          error: 'A valid ride ID is required.',
        });
        return;
      }

      try {
        const user = await getSessionUser(socket.handshake.headers.cookie ?? '');
        if (!user || user.id !== socket.data.userId) {
          socket.emit('ride:chat:error', {
            code: 'AUTHENTICATION_REQUIRED',
            error: 'Sign in again to join this chat.',
          });
          socket.disconnect(true);
          return;
        }
        const member = await isRideMember(rideId, socket.data.userId);
        if (!member) {
          socket.emit('ride:chat:error', {
            code: 'FORBIDDEN',
            error: 'Only current pool members may join this chat.',
          });
          return;
        }

        socket.data.rideId = rideId;
        socket.join(`ride:${rideId}`);
        socket.emit('ride:chat:joined', { rideId });
      } catch (error) {
        console.error('Ride chat membership verification failed:', error);
        socket.emit('ride:chat:error', {
          code: 'ACCESS_CHECK_FAILED',
          error: 'Chat access could not be verified. Try again.',
        });
      }
    });

    socket.on('ride:chat:leave', (payload) => {
      const rideId = payload && typeof payload.rideId === 'string' ? payload.rideId : '';
      if (typeof rideId === 'string' && rideId) {
        socket.leave(`ride:${rideId}`);
      }
    });

    registerRideChatMessageHandler(io, socket, {
      authenticate: async (connectedSocket) =>
        getSessionUser(connectedSocket.handshake.headers.cookie ?? ''),
      isMember: isRideMember,
      createMessage: (rideId, senderId, message) =>
        createChatMessageForSocket(rideId, senderId, message, new Date()),
    });
  });

  void runChatMaintenance();
  setInterval(() => void runChatMaintenance(), 30_000);

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port} (${dev ? 'dev' : 'prod'})`);
  });
});
