import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import {
  createChatMessage,
  getRideChatThread,
  reportChatMessage,
  rideChatAvailable,
  rideChatCanWrite,
  rideChatDeletionDue,
  rideChatReadOnly,
} from './ride-chat';

beforeEach(() => {
  query.mockReset();
});

describe('ride-chat domain helpers', () => {
  it('opens once the ride locks and closes after completion', () => {
    const ride = { state: 'scheduled', departure_start: new Date('2026-10-10T06:30:00+05:30') };
    expect(rideChatAvailable(ride as never, new Date('2026-10-10T00:00:00+05:30'))).toBe(false);
    expect(rideChatAvailable(ride as never, new Date('2026-10-10T05:30:00+05:30'))).toBe(true);

    expect(
      rideChatReadOnly(
        {
          state: 'completed',
          completed_at: new Date('2026-10-10T06:45:00+05:30'),
          cancelled_at: null,
        },
        new Date('2026-10-11T06:46:00+05:30'),
      ),
    ).toBe(true);
  });

  it('stops writes immediately when cancelled and keeps unresolved reports past expiry', () => {
    const cancelled = {
      state: 'cancelled' as const,
      completed_at: null,
      cancelled_at: new Date('2026-10-10T06:00:00Z'),
    };
    expect(rideChatCanWrite(cancelled, new Date('2026-10-10T06:01:00Z'))).toBe(false);
    expect(rideChatReadOnly(cancelled, new Date('2026-10-10T06:01:00Z'))).toBe(false);
    expect(rideChatDeletionDue(cancelled, new Date('2026-11-10T05:59:59.999Z'))).toBe(false);
    expect(rideChatDeletionDue(cancelled, new Date('2026-11-10T06:00:00Z'))).toBe(true);
  });

  it('loads the pool chat only for current members and returns the thread', async () => {
    const rideId = '0b9a7c1e-1111-4000-8000-000000000001';
    const viewerId = '6f1c2a5e-2222-4000-8000-000000000002';
    const now = new Date('2026-10-10T06:00:00+05:30');
    let count = 0;

    query.mockImplementation(() => {
      count += 1;
      if (count === 1) {
        return Promise.resolve({
          rows: [
            {
              id: rideId,
              owner_id: 'owner-1',
              state: 'scheduled',
              departure_start: new Date('2026-10-10T06:30:00+05:30'),
              completed_at: null,
              cancelled_at: null,
            },
          ],
        });
      }
      if (count === 2) {
        return Promise.resolve({ rows: [{ user_id: 'owner-1' }, { user_id: viewerId }] });
      }
      if (count === 3) {
        return Promise.resolve({ rows: [] });
      }
      if (count === 4) {
        return Promise.resolve({
          rows: [{ id: 'chat-1', ride_id: rideId, opened_at: now, closed_at: null }],
        });
      }
      return Promise.resolve({
        rows: [
          {
            id: 'm-1',
            sender_id: 'owner-1',
            sender_name: 'Ananya',
            body: 'On my way',
            created_at: new Date('2026-10-10T06:02:00+05:30'),
            reported_at: null,
            viewer_is_sender: false,
          },
        ],
      });
    });

    await expect(getRideChatThread(rideId, viewerId, now)).resolves.toMatchObject({
      id: 'chat-1',
      rideId,
      messages: [{ senderName: 'Ananya', body: 'On my way' }],
      canWrite: true,
    });
  });

  it('stores a valid message, rejects oversized text and rate-limited posts, and blocks read-only chat', async () => {
    const rideId = '0b9a7c1e-1111-4000-8000-000000000001';
    const senderId = '6f1c2a5e-2222-4000-8000-000000000002';
    const now = new Date('2026-10-10T06:20:00+05:30');

    query.mockImplementation((sql: string) => {
      const statement = String(sql).toLowerCase();
      if (statement.includes('count(*)')) {
        return Promise.resolve({ rows: [{ count: 0 }] });
      }
      if (statement.includes('select owner_id as user_id')) {
        return Promise.resolve({ rows: [{ user_id: 'owner-1' }, { user_id: senderId }] });
      }
      if (statement.includes('from rides where id')) {
        return Promise.resolve({
          rows: [
            {
              id: rideId,
              owner_id: 'owner-1',
              state: 'scheduled',
              departure_start: new Date('2026-10-10T06:30:00+05:30'),
              completed_at: null,
              cancelled_at: null,
            },
          ],
        });
      }
      if (statement.includes('select id, ride_id, opened_at, closed_at from ride_chats')) {
        return Promise.resolve({ rows: [] });
      }
      if (statement.includes('insert into ride_chats')) {
        return Promise.resolve({
          rows: [{ id: 'chat-1', ride_id: rideId, opened_at: now, closed_at: null }],
        });
      }
      if (
        statement.includes('insert into notifications') &&
        statement.includes('related_message_id')
      ) {
        return Promise.resolve({ rows: [{ id: 'notif-2' }] });
      }
      if (statement.includes('insert into notifications')) {
        return Promise.resolve({ rows: [{ id: 'notif-1' }] });
      }
      if (statement.includes('insert into ride_chat_messages')) {
        return Promise.resolve({
          rows: [{ id: 'm-2', sender_id: senderId, body: 'See you at Hall 6', created_at: now }],
        });
      }
      if (statement.includes('select user_id from (')) {
        return Promise.resolve({ rows: [{ user_id: 'owner-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      createChatMessage(rideId, senderId, 'See you at Hall 6', now),
    ).resolves.toMatchObject({
      ok: true,
      message: { senderName: 'You', body: 'See you at Hall 6' },
    });

    await expect(createChatMessage(rideId, senderId, 'x'.repeat(501), now)).resolves.toMatchObject({
      ok: false,
      code: 'INVALID_MESSAGE',
    });

    query.mockResolvedValueOnce({ rows: [{ count: 20 }] });
    await expect(
      createChatMessage(rideId, senderId, 'Too many messages', now),
    ).resolves.toMatchObject({
      ok: false,
      code: 'RATE_LIMITED',
    });

    query
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: rideId,
            owner_id: 'owner-1',
            state: 'completed',
            departure_start: new Date('2026-10-10T06:30:00+05:30'),
            completed_at: new Date('2026-10-10T06:00:00+05:30'),
            cancelled_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ user_id: 'owner-1' }, { user_id: senderId }] });

    await expect(
      createChatMessage(rideId, senderId, 'Too late', new Date('2026-10-11T06:30:00+05:30')),
    ).resolves.toMatchObject({
      ok: false,
      code: 'CHAT_READ_ONLY',
    });
  });

  it('reports a message by reference and refuses it if the sender is the reporter', async () => {
    const rideId = '0b9a7c1e-1111-4000-8000-000000000001';
    const reporterId = '8c57f0d3-2222-4000-8000-000000000002';
    const senderId = '6f1c2a5e-3333-4000-8000-000000000003';
    const messageId = '44ca86d4-4444-4000-8000-000000000004';
    const now = new Date('2026-10-10T06:20:00+05:30');

    query.mockResolvedValueOnce({
      rows: [
        {
          id: rideId,
          owner_id: 'owner-1',
          state: 'scheduled',
          departure_start: new Date('2026-10-10T06:30:00+05:30'),
          completed_at: null,
          cancelled_at: null,
        },
      ],
    });
    query.mockResolvedValueOnce({
      rows: [{ user_id: 'owner-1' }, { user_id: reporterId }, { user_id: senderId }],
    });
    query.mockResolvedValueOnce({
      rows: [{ id: 'chat-1', ride_id: rideId, opened_at: now, closed_at: null }],
    });
    query.mockResolvedValueOnce({ rows: [{ reference: `chat-${messageId.slice(0, 8)}` }] });

    await expect(
      reportChatMessage(rideId, reporterId, messageId, 'Spam', now),
    ).resolves.toMatchObject({
      ok: true,
      reference: `chat-${messageId.slice(0, 8)}`,
    });

    query.mockResolvedValueOnce({
      rows: [
        {
          id: rideId,
          owner_id: 'owner-1',
          state: 'scheduled',
          departure_start: new Date('2026-10-10T06:30:00+05:30'),
          completed_at: null,
          cancelled_at: null,
        },
      ],
    });
    query.mockResolvedValueOnce({ rows: [{ user_id: 'owner-1' }, { user_id: senderId }] });
    query.mockResolvedValueOnce({
      rows: [{ id: 'chat-1', ride_id: rideId, opened_at: now, closed_at: null }],
    });
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      reportChatMessage(rideId, senderId, messageId, 'Spam', now),
    ).resolves.toMatchObject({
      ok: false,
      code: 'REPORT_FAILED',
    });
  });
});
