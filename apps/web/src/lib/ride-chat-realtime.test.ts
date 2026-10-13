import { createServer, type Server as HttpServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Server as SocketServer } from 'socket.io';
import { io as createSocketClient, type Socket } from 'socket.io-client';
import {
  SUSPENDED_CHAT_ERROR,
  registerRideChatMessageHandler,
  rideChatAvailable,
  senderSuspended,
} from './ride-chat-realtime.mjs';

describe('senderSuspended (FR-RD-01.5)', () => {
  const userId = '6f1c2a5e-2222-4000-8000-000000000002';
  const now = new Date('2026-10-13T12:00:00.000Z');

  it('finds a suspension in force at the given time, by the active_rider_suspensions rule', async () => {
    const calls: Array<[string, unknown[]]> = [];
    const db = {
      query: async (sql: string, values: unknown[]) => {
        calls.push([sql, values]);
        return { rows: [{ '?column?': 1 }] };
      },
    };
    await expect(senderSuspended(db, userId, now)).resolves.toBe(true);
    expect(calls[0][0]).toContain('FROM rider_suspensions');
    expect(calls[0][0]).toContain('lifted_at IS NULL AND starts_at <= $2');
    expect(calls[0][0]).toContain('(ends_at IS NULL OR ends_at > $2)');
    expect(calls[0][1]).toEqual([userId, now]);
  });

  it('lets anyone without a suspension in force post', async () => {
    const db = { query: async () => ({ rows: [] }) };
    await expect(senderSuspended(db, userId, now)).resolves.toBe(false);
    expect(SUSPENDED_CHAT_ERROR).toMatch(/suspended.*cannot post.*still read/);
  });
});

describe('rideChatAvailable for realtime messaging', () => {
  const departureStart = new Date('2026-10-10T06:30:00+05:30');
  const beforeScheduledLock = new Date('2026-10-10T01:00:00+05:30');

  it('allows a manually locked ride to use chat before the scheduled lock time', () => {
    expect(
      rideChatAvailable(
        {
          state: 'scheduled',
          departure_start: departureStart,
          locked_at: new Date('2026-10-10T00:30:00+05:30'),
        },
        beforeScheduledLock,
      ),
    ).toBe(true);
  });

  it('keeps an unlocked ride unavailable before its scheduled lock time', () => {
    expect(
      rideChatAvailable(
        { state: 'scheduled', departure_start: departureStart, locked_at: null },
        beforeScheduledLock,
      ),
    ).toBe(false);
  });
});

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

describe('ride chat live delivery', () => {
  let httpServer: HttpServer;
  let io: SocketServer;
  let sender: Socket;
  let recipient: Socket;
  let persisted = false;

  beforeEach(async () => {
    persisted = false;
    httpServer = createServer();
    io = new SocketServer(httpServer, { transports: ['websocket'] });
    io.on('connection', (socket) => {
      socket.data.userId = socket.handshake.auth.userId;
      socket.data.userName = socket.handshake.auth.userName;
      socket.join('ride:ride-1');
      registerRideChatMessageHandler(io, socket, {
        authenticate: async (connectedSocket: import('socket.io').Socket) => ({
          id: connectedSocket.data.userId,
        }),
        isMember: async (_rideId: string, userId: string) => userId !== 'former-member',
        createMessage: async (_rideId: string, senderId: string, body: string) => {
          persisted = true;
          return {
            ok: true,
            message: {
              id: 'message-1',
              senderId,
              senderName: 'You',
              body,
              createdAt: new Date().toISOString(),
              isMine: true,
              reported: false,
            },
          };
        },
      });
      socket.emit('ready');
    });

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start.');
    const connect = (userId: string, userName: string) => {
      const client = createSocketClient(`http://127.0.0.1:${address.port}`, {
        transports: ['websocket'],
        auth: { userId, userName },
        autoConnect: false,
      });
      return client;
    };
    sender = connect('sender', 'Sender');
    recipient = connect('recipient', 'Recipient');
    const ready = Promise.all([
      waitForEvent<void>(sender, 'ready'),
      waitForEvent<void>(recipient, 'ready'),
    ]);
    sender.connect();
    recipient.connect();
    await ready;
  });

  afterEach(async () => {
    sender.disconnect();
    recipient.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  it('persists, acknowledges, and delivers to connected members within the one-second target', async () => {
    const latencies: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const delivered = waitForEvent<{
        rideId: string;
        body: string;
        senderName: string;
        isMine: boolean;
      }>(recipient, 'ride:chat:message');
      const startedAt = performance.now();
      const acknowledged = new Promise<{
        ok: boolean;
        message: { body: string; senderName: string };
      }>((resolve, reject) => {
        sender.timeout(1000).emit(
          'ride:chat:message',
          { rideId: 'ride-1', message: `Message ${index}` },
          (
            timeoutError: Error | null,
            response: {
              ok: boolean;
              message?: { body: string; senderName: string };
              error?: string;
            },
          ) => {
            if (timeoutError) reject(timeoutError);
            else if (!response.ok || !response.message) reject(new Error(response.error));
            else resolve({ ok: true, message: response.message });
          },
        );
      });
      const [deliveredMessage, acknowledgement] = await Promise.all([delivered, acknowledged]);
      latencies.push(performance.now() - startedAt);
      expect(persisted).toBe(true);
      expect(deliveredMessage).toMatchObject({
        rideId: 'ride-1',
        body: `Message ${index}`,
        senderName: 'Sender',
        isMine: false,
      });
      expect(acknowledgement.message).toMatchObject({
        body: `Message ${index}`,
        senderName: 'Sender',
      });
    }

    latencies.sort((a, b) => a - b);
    expect(latencies[Math.ceil(latencies.length * 0.95) - 1]).toBeLessThan(1000);
  });
});
