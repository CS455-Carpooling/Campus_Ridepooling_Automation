import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATION_CHANNEL,
  joinAuthenticatedNotificationRoom,
  notificationRoom,
  registerNotificationInsertHandler,
} from './notification-realtime.mjs';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const notificationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: notificationId,
    user_id: userA,
    type: 'ride_update',
    title: 'Ride updated',
    body: 'Your ride time changed.',
    related_ride_id: null,
    related_chat_id: null,
    related_message_id: null,
    read_at: null,
    created_at: new Date('2026-10-12T10:00:00.000Z'),
    ...overrides,
  };
}

describe('notification realtime delivery', () => {
  it('joins only the room for the authenticated server-side socket identity', () => {
    const join = vi.fn();
    const socket = {
      data: { userId: userA },
      handshake: { auth: { userId: userB, room: notificationRoom(userB) } },
      join,
    };

    expect(joinAuthenticatedNotificationRoom(socket)).toBe(true);
    expect(join).toHaveBeenCalledOnce();
    expect(join).toHaveBeenCalledWith(notificationRoom(userA));
    expect(join).not.toHaveBeenCalledWith(notificationRoom(userB));
  });

  it('does not join a notification room when no authenticated identity exists', () => {
    const join = vi.fn();
    expect(joinAuthenticatedNotificationRoom({ data: {}, join })).toBe(false);
    expect(join).not.toHaveBeenCalled();
  });

  it('re-reads the persisted row and delivers only to that row recipient', async () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const loadNotification = vi.fn(async (id: string) => {
      expect(id).toBe(notificationId);
      return row({ user_id: userB });
    });
    const deliver = registerNotificationInsertHandler({ to }, { loadNotification });

    expect(await deliver(notificationId)).toBe(true);
    expect(loadNotification).toHaveBeenCalledOnce();
    expect(to).toHaveBeenCalledWith(notificationRoom(userB));
    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith('notification:new', {
      id: notificationId,
      type: 'ride_update',
      title: 'Ride updated',
      body: 'Your ride time changed.',
      relatedRideId: null,
      relatedChatId: null,
      relatedMessageId: null,
      readAt: null,
      createdAt: '2026-10-12T10:00:00.000Z',
    });
  });

  it('does not emit before canonical database lookup completes', async () => {
    let lookupCompleted = false;
    const emit = vi.fn(() => {
      expect(lookupCompleted).toBe(true);
    });
    const deliver = registerNotificationInsertHandler(
      { to: () => ({ emit }) },
      {
        loadNotification: async () => {
          await Promise.resolve();
          lookupCompleted = true;
          return row();
        },
      },
    );

    await deliver(notificationId);
    expect(emit).toHaveBeenCalledOnce();
  });

  it('ignores invalid IDs, missing rows, and rows without a trusted recipient', async () => {
    const to = vi.fn(() => ({ emit: vi.fn() }));
    const loadNotification = vi.fn(async (id: string) =>
      id === notificationId ? row({ user_id: 'not-a-uuid' }) : null,
    );
    const deliver = registerNotificationInsertHandler({ to }, { loadNotification });

    expect(await deliver({ id: notificationId, user_id: userA })).toBe(false);
    expect(await deliver('not-a-uuid')).toBe(false);
    expect(await deliver(notificationId)).toBe(false);
    expect(to).not.toHaveBeenCalled();
    expect(loadNotification).toHaveBeenCalledOnce();
  });

  it('contains database errors rather than crashing the listener callback', async () => {
    const logger = { error: vi.fn() } as unknown as Console;
    const deliver = registerNotificationInsertHandler(
      { to: vi.fn() },
      {
        loadNotification: async () => {
          throw new Error('database offline');
        },
        logger,
      },
    );

    expect(await deliver(notificationId)).toBe(false);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('checks the notification insert trigger is commit-aware', async () => {
      const schema = await readFile(new URL('../../db/schema.sql', import.meta.url), 'utf8');
      expect(schema).toContain(`PERFORM pg_notify('${NOTIFICATION_CHANNEL}', NEW.id::text);`);
      expect(schema).toMatch(
        /CREATE TRIGGER notifications_realtime_insert\s+AFTER INSERT ON notifications/,
      );
      expect(schema).toContain('EXECUTE FUNCTION notify_notification_inserted()');
    },
  );
});
