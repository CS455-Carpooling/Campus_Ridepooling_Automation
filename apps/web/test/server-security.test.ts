// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { io as connectSocket } from 'socket.io-client';
import type { Server as HttpServer } from 'node:http';
import type { Server as SocketServer } from 'socket.io';

const harness = vi.hoisted(() => ({
  httpServer: null as unknown,
  ioServer: null as unknown,
  query: vi.fn(),
}));

vi.mock('next', () => ({
  default: () => ({
    getRequestHandler: () => () => undefined,
    prepare: async () => undefined,
  }),
}));

vi.mock('pg', () => ({
  Pool: class {
    query = harness.query;
    on() {
      return this;
    }
    end() {
      return Promise.resolve();
    }
  },
  Client: class {
    on() {
      return this;
    }
    once() {
      return this;
    }
    connect() {
      return new Promise(() => undefined);
    }
  },
}));

vi.mock('socket.io', async (importOriginal) => {
  const actual = await importOriginal<typeof import('socket.io')>();
  return {
    ...actual,
    Server: class extends actual.Server {
      constructor(...args: ConstructorParameters<typeof actual.Server>) {
        super(...args);
        harness.httpServer = args[0];
        harness.ioServer = this;
      }
    },
  };
});

describe('Socket.IO security boundaries', () => {
  let baseUrl: string;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_URL', 'https://campus.test/');
    vi.stubEnv('PORT', '0');
    vi.stubEnv('DATABASE_URL', '');
    harness.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sessions s')) {
        return {
          rows: sessionIsActive
            ? [{ id: '11111111-1111-4111-8111-111111111111', role: 'rider', display_name: 'Test' }]
            : [],
        };
      }
      return { rows: [] };
    });

    await import('../server.mjs');
    await Promise.resolve();
    await Promise.resolve();

    const server = harness.httpServer as HttpServer | null;
    if (!server) throw new Error('Socket.IO server did not start.');
    if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
    vi.useRealTimers();
  });

  afterAll(async () => {
    const ioServer = harness.ioServer as SocketServer | null;
    if (ioServer) await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  let sessionIsActive = true;

  async function connect(origin: string, cookie: string) {
    const socket = connectSocket(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { Origin: origin, Cookie: cookie },
      reconnection: false,
      timeout: 2_000,
    });

    const result = await new Promise<
      | { connected: true; socket: typeof socket }
      | { connected: false; error: Error; socket: typeof socket }
    >((resolve) => {
      socket.once('connect', () => resolve({ connected: true, socket }));
      socket.once('connect_error', (error) => resolve({ connected: false, error, socket }));
    });
    return result;
  }

  it('rejects a credentialed WebSocket handshake from an untrusted Origin', async () => {
    sessionIsActive = true;
    harness.query.mockClear();

    const result = await connect('https://attacker.example', '__Host-crp_session=valid-token');

    expect(result.connected).toBe(false);
    expect(harness.query).not.toHaveBeenCalledWith(
      expect.stringContaining('FROM sessions s'),
      expect.anything(),
    );
    result.socket.disconnect();
  });

  it('refuses malformed cookies without crashing the server', async () => {
    sessionIsActive = true;
    harness.query.mockClear();

    const malformed = await connect(
      'https://campus.test',
      '__Host-crp_session=%E0%A4%A',
    );
    expect(malformed.connected).toBe(false);
    if (malformed.connected) return;
    expect(malformed.error.message).toBe('Authentication required.');
    expect(harness.query).not.toHaveBeenCalledWith(
      expect.stringContaining('FROM sessions s'),
      expect.anything(),
    );
    malformed.socket.disconnect();

    const valid = await connect('https://campus.test', '__Host-crp_session=valid-token');
    expect(valid.connected).toBe(true);
    valid.socket.disconnect();
  });

  it('rejects sessions outside the seven-day inactivity window', async () => {
    sessionIsActive = false;
    harness.query.mockClear();

    const result = await connect('https://campus.test', '__Host-crp_session=stale-token');

    expect(result.connected).toBe(false);
    if (result.connected) return;
    expect(result.error.message).toBe('Authentication required.');
    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining("last_activity_at > now() - interval '7 days'"),
      expect.any(Array),
    );
    result.socket.disconnect();
  });
});
