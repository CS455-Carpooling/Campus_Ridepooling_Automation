'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const controller = new AbortController();

    async function fetchNotifications() {
      try {
        const response = await fetch('/api/notifications?limit=100&offset=0', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Could not load notifications.');
        }

        const data = (await response.json()) as Partial<ListResponse>;

        if (!Array.isArray(data.notifications) || !data.notifications.every(isNotification)) {
          throw new Error('The notifications response was invalid.');
        }

        if (!controller.signal.aborted) {
          setItems(data.notifications);
          setError(null);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;

        setError(cause instanceof Error ? cause.message : 'Could not load notifications.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchNotifications();

    return () => controller.abort();
  }, [retryCount]);

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
