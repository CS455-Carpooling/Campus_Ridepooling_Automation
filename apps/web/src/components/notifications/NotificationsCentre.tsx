'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io as createSocketClient } from 'socket.io-client';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { formatDeparture } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { routes } from '@/lib/routes';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  relatedRideId: string | null;
  relatedChatId: string | null;
  relatedMessageId: string | null;
  readAt: string | null;
  createdAt: string;
};

type ListResponse = {
  notifications: Notification[];
  pagination: { hasMore: boolean; limit: number; offset: number };
};

type SocketNotification = { notification: Notification; sequence: number };

function isNotification(value: unknown): value is Notification {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.body === 'string' &&
    typeof item.createdAt === 'string' &&
    (item.readAt === null || typeof item.readAt === 'string') &&
    typeof item.type === 'string' &&
    (item.relatedRideId === null || typeof item.relatedRideId === 'string') &&
    (item.relatedChatId === null || typeof item.relatedChatId === 'string') &&
    (item.relatedMessageId === null || typeof item.relatedMessageId === 'string')
  );
}

function sortAndLimit(items: Notification[]): Notification[] {
  return [...items]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 100);
}

function mergeRealtimeNotification(
  current: Notification[],
  incoming: Notification,
): Notification[] {
  const items = new Map(current.map((item) => [item.id, item]));
  const existing = items.get(incoming.id);
  // A delayed INSERT event must not undo a later successful mark-as-read update.
  items.set(
    incoming.id,
    existing ? { ...incoming, readAt: existing.readAt ?? incoming.readAt } : incoming,
  );
  return sortAndLimit([...items.values()]);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  return formatDeparture(date.toISOString());
}

function rideDestination(id: string | null): string | null {
  // A notification may contain stale or malformed related-resource identifiers.
  // Only UUID ride IDs are supported by the existing ride detail route.
  return id && isUuid(id) ? routes.ride(id) : null;
}

export function NotificationsCentre() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mounted = useRef(false);
  const socketEventSequence = useRef(0);
  const latestAppliedRequest = useRef(0);
  const requestSequence = useRef(0);
  const socketEvents = useRef(new Map<string, SocketNotification>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshNotifications = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestSequence.current;
    const sequenceAtStart = socketEventSequence.current;

    try {
      const options: RequestInit = {
        credentials: 'same-origin',
        cache: 'no-store',
      };
      if (signal) options.signal = signal;
      const response = await fetch('/api/notifications?limit=100&offset=0', options);

      if (!response.ok) {
        throw new Error('Could not load notifications.');
      }

      const data = (await response.json()) as Partial<ListResponse>;
      if (!Array.isArray(data.notifications) || !data.notifications.every(isNotification)) {
        throw new Error('The notifications response was invalid.');
      }
      const notifications = data.notifications;

      if (!mounted.current || requestId < latestAppliedRequest.current) return;
      latestAppliedRequest.current = requestId;

      setItems((currentItems) => {
        // A refresh may have started before a successful mark-as-read PATCH and return stale
        // readAt: null afterward. Read state is monotonic, so never undo a locally confirmed read.
        const currentById = new Map(currentItems.map((item) => [item.id, item] as const));
        const merged = new Map(
          notifications.map((item) => {
            const current = currentById.get(item.id);
            return [item.id, current?.readAt ? { ...item, readAt: current.readAt } : item] as const;
          }),
        );
        // Preserve socket events that arrived while this request was in flight, covering the
        // commit/query/subscribe race without keeping unrelated stale rows.
        for (const { notification, sequence } of socketEvents.current.values()) {
          if (sequence > sequenceAtStart && !merged.has(notification.id)) {
            merged.set(notification.id, notification);
          }
        }
        return sortAndLimit([...merged.values()]);
      });
      setError(null);
    } catch (cause) {
      if (signal?.aborted || !mounted.current || requestId < latestAppliedRequest.current) return;
      setError(cause instanceof Error ? cause.message : 'Could not load notifications.');
    } finally {
      if (mounted.current && requestId === requestSequence.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshNotifications(controller.signal);
    return () => controller.abort();
  }, [refreshNotifications, retryCount]);

  useEffect(() => {
    const socket = createSocketClient({
      path: '/socket.io/',
      transports: ['websocket'],
      withCredentials: true,
    });

    const handleNewNotification = (value: unknown) => {
      if (!isNotification(value)) {
        setError('A live notification payload was invalid.');
        return;
      }
      const sequence = ++socketEventSequence.current;
      socketEvents.current.set(value.id, { notification: value, sequence });
      if (socketEvents.current.size > 200) {
        const oldest = [...socketEvents.current.entries()]
          .sort((a, b) => a[1].sequence - b[1].sequence)
          .slice(0, socketEvents.current.size - 150);
        for (const [id] of oldest) socketEvents.current.delete(id);
      }
      setItems((current) => mergeRealtimeNotification(current, value));
      setError(null);
    };

    const handleConnect = () => {
      void refreshNotifications();
    };

    const handleSync = () => {
      void refreshNotifications();
    };

    const handleConnectError = () => {
      setError('Live updates are temporarily unavailable. Reconnecting…');
    };

    const handleDisconnect = (reason: string) => {
      if (reason !== 'io client disconnect') {
        setError('Live updates disconnected. Reconnecting…');
      }
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications();
      }
    };

    // Socket.IO re-emits "connect" after an automatic reconnect. Always reconcile from the
    // database on connect (including the first one) to close any initial subscription race.
    socket.on('connect', handleConnect);
    socket.on('notification:new', handleNewNotification);
    socket.on('notification:sync', handleSync);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:sync', handleSync);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      document.removeEventListener('visibilitychange', handleVisible);
      socket.disconnect();
    };
  }, [refreshNotifications]);

  async function markRead(item: Notification) {
    if (item.readAt || marking) return;
    setMarking(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error('Could not mark this notification as read. Please try again.');
      const data = (await response.json()) as { notification?: { id?: unknown; readAt?: unknown } };
      if (
        data.notification?.id !== item.id ||
        typeof data.notification.readAt !== 'string' ||
        !Number.isFinite(new Date(data.notification.readAt).getTime())
      ) {
        throw new Error('The read status response was invalid. Please refresh and try again.');
      }
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: data.notification!.readAt as string } : entry,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this notification.');
    } finally {
      setMarking(null);
    }
  }

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
            Your account
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Notifications</h1>
          <p className="mt-2 text-ink-muted">
            {error && items.length === 0
              ? 'Unread count unavailable'
              : `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`}
          </p>
        </div>
        <ButtonLink href={routes.home} variant="secondary">
          Back to home
        </ButtonLink>
      </header>

      {error && (
        <div role="alert" className="mt-6 border border-line-strong p-4">
          <p>{error}</p>
          {items.length === 0 && (
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => {
                setLoading(true);
                setError(null);
                setRetryCount((count) => count + 1);
              }}
            >
              Try again
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <LoadingRegion label="Loading notifications" className="mt-8 space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="border-b border-line py-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-1/3" />
            </div>
          ))}
        </LoadingRegion>
      ) : items.length === 0 && !error ? (
        <section className="mt-8 border-y border-line py-10" aria-labelledby="empty-heading">
          <h2 id="empty-heading" className="text-xl font-bold">
            You&apos;re all caught up
          </h2>
          <p className="mt-2 text-ink-muted">New notifications will appear here.</p>
        </section>
      ) : items.length > 0 ? (
        <ul
          aria-label="Your notifications"
          className="mt-8 divide-y divide-line border-y border-line"
        >
          {items.map((item) => {
            const destination = rideDestination(item.relatedRideId);
            const unread = !item.readAt;
            return (
              <li key={item.id} className="py-5">
                <article
                  aria-label={item.title}
                  className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{item.title}</h2>
                      <span
                        className={
                          unread
                            ? 'border border-line-strong px-2 py-0.5 text-xs font-semibold'
                            : 'border border-line px-2 py-0.5 text-xs text-ink-muted'
                        }
                      >
                        {unread ? 'Unread' : 'Read'}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-ink-muted">{item.body}</p>
                    <p className="mt-3 text-sm text-ink-muted">
                      <time dateTime={item.createdAt}>{formatTimestamp(item.createdAt)}</time>
                    </p>
                    {destination && (
                      <Link
                        href={destination}
                        className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                      >
                        View related ride
                      </Link>
                    )}
                  </div>
                  {unread && (
                    <Button
                      variant="secondary"
                      className="shrink-0 self-start"
                      disabled={marking !== null}
                      aria-label={`Mark as read: ${item.title}`}
                      onClick={() => void markRead(item)}
                    >
                      {marking === item.id ? 'Marking read…' : 'Mark as read'}
                    </Button>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!loading && items.length === 100 && (
        <p className="mt-4 text-sm text-ink-muted">
          Showing the latest 100 notifications. Older notifications are not shown on this page yet.
        </p>
      )}
    </DesignSystem>
  );
}
