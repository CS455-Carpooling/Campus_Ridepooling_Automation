import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsCentre } from './NotificationsCentre';

const socketState = vi.hoisted(() => ({
  handlers: {} as Record<string, Array<(payload?: unknown) => void>>,
  disconnect: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (event: string, handler: (payload?: unknown) => void) => {
      (socketState.handlers[event] ??= []).push(handler);
    },
    off: (event: string, handler: (payload?: unknown) => void) => {
      socketState.handlers[event] = (socketState.handlers[event] ??= []).filter(
        (candidate) => candidate !== handler,
      );
    },
    disconnect: socketState.disconnect,
  })),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const notification = {
  id: 'n1',
  type: 'ride_update',
  title: 'Ride updated',
  body: 'Your ride time changed.',
  relatedRideId: '11111111-1111-4111-8111-111111111111',
  relatedChatId: null,
  relatedMessageId: null,
  readAt: null,
  createdAt: '2026-10-12T10:00:00.000Z',
};

function listResponse(notifications: Array<Record<string, unknown>> = []) {
  return Response.json({
    notifications,
    pagination: { hasMore: false, limit: 100, offset: 0 },
  });
}

function emitSocketEvent(event: string, payload?: unknown) {
  for (const handler of [...(socketState.handlers[event] ?? [])]) {
    handler(payload);
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  socketState.handlers = Object.create(null) as Record<string, Array<(payload?: unknown) => void>>;
  socketState.disconnect.mockClear();
});

describe('NotificationsCentre', () => {
  it('shows a loading state while retrieving notifications', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    render(<NotificationsCentre />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading notifications');
  });

  it('shows an empty state when there are no notifications', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(listResponse());
    render(<NotificationsCentre />);
    expect(
      await screen.findByRole('heading', { name: "You're all caught up" }),
    ).toBeInTheDocument();
  });

  it('shows notification content, timestamp, unread state and a valid ride link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(listResponse([notification]));
    render(<NotificationsCentre />);
    expect(await screen.findByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
    expect(screen.getByText('Your ride time changed.')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View related ride' })).toHaveAttribute(
      'href',
      '/rides/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText(/12 Oct, 15:30/)).toBeInTheDocument();
  });

  it(
    'marks a notification read only after the API confirms and reflects persisted state',
    async () => {
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(listResponse([notification]))
        .mockResolvedValueOnce(
          Response.json({ notification: { id: 'n1', readAt: '2026-10-12T10:05:00.000Z' } }),
        );
      render(<NotificationsCentre />);
      fireEvent.click(await screen.findByRole('button', { name: 'Mark as read: Ride updated' }));
      expect(await screen.findByText('Read')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Mark as read: Ride updated' }),
      ).not.toBeInTheDocument();
      expect(fetch).toHaveBeenLastCalledWith(
        '/api/notifications/n1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    },
  );

  it('shows an error and retry when listing fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 500 }));
    render(<NotificationsCentre />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load notifications.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByText('Unread count unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0 unread notifications')).not.toBeInTheDocument();
  });

  it('keeps unread state when marking read fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(listResponse([notification]))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    render(<NotificationsCentre />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as read: Ride updated' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not mark this notification as read',
    );
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('accepts all supported notification types in the same response', async () => {
    const additionalTypes = [
      'account_warning',
      'account_suspended',
      'account_reactivated',
      'complaint_update',
    ] as const;
    const notifications = [
      notification,
      ...additionalTypes.map((type, index) => ({
        ...notification,
        id: `n-${type}`,
        type,
        title: `Notice: ${type}`,
        relatedRideId: null,
        createdAt: `2026-10-12T10:0${index + 1}:00.000Z`,
      })),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(listResponse(notifications));
    render(<NotificationsCentre />);
    for (const type of additionalTypes) {
      expect(await screen.findByRole('heading', { name: `Notice: ${type}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps notifications visible when the API adds an unknown type', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      listResponse([
        notification,
        {
          ...notification,
          id: 'n-trip',
          type: 'trip_update',
          title: 'Trip updated',
          relatedRideId: null,
        },
      ]),
    );

    render(<NotificationsCentre />);

    expect(await screen.findByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Trip updated' })).toBeInTheDocument();
    expect(screen.queryByText('The notifications response was invalid.')).not.toBeInTheDocument();
  });

  it('does not link malformed related ride identifiers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      listResponse([
        { ...notification, relatedRideId: 'not-a-uuid', relatedChatId: 'stale-chat' },
      ]),
    );
    render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: 'Ride updated' });
    expect(screen.queryByRole('link', { name: 'View related ride' })).not.toBeInTheDocument();
  });

  it(
    'inserts incoming socket notifications immediately and deduplicates by notification ID',
    async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(listResponse([notification]));
      render(<NotificationsCentre />);
      await screen.findByRole('heading', { name: 'Ride updated' });
      const liveNotification = {
        ...notification,
        id: 'n2',
        title: 'New ride message',
        body: 'A new message has arrived.',
        createdAt: '2026-10-12T10:05:00.000Z',
      };

      act(() => emitSocketEvent('notification:new', liveNotification));
      expect(await screen.findByRole('heading', { name: 'New ride message' })).toBeInTheDocument();
      act(() => emitSocketEvent('notification:new', liveNotification));
      expect(screen.getAllByRole('heading', { name: 'New ride message' })).toHaveLength(1);
      expect(screen.getByText('2 unread notifications')).toBeInTheDocument();
    },
  );

  it('does not revert a notification to unread when its delayed insert event arrives', async () => {
    const readNotification = {
      ...notification,
      readAt: '2026-10-12T10:05:00.000Z',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(listResponse([readNotification]));
    render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: 'Ride updated' });

    act(() => emitSocketEvent('notification:new', notification));
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as read: Ride updated' })).not.toBeInTheDocument();
  });

  it('refetches persisted notifications after reconnect', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(listResponse())
      .mockResolvedValueOnce(listResponse())
      .mockResolvedValueOnce(listResponse([notification]));
    render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: "You're all caught up" });

    act(() => emitSocketEvent('connect'));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: "You're all caught up" })).toBeInTheDocument(),
    );

    act(() => emitSocketEvent('connect'));
    expect(await screen.findByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('reports realtime connection errors while keeping the persisted list usable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(listResponse([notification]));
    render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: 'Ride updated' });
    act(() => emitSocketEvent('connect_error', new Error('offline')));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Live updates are temporarily unavailable',
    );
    expect(screen.getByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
  });

  it('reconciles from the API when the server signals a listener resynchronization', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(listResponse())
      .mockResolvedValueOnce(listResponse([notification]));
    render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: "You're all caught up" });
    act(() => emitSocketEvent('notification:sync'));
    expect(await screen.findByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
  });

  it('refetches persisted notifications when the tab becomes visible again', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(listResponse())
      .mockResolvedValueOnce(listResponse([notification]));
    render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: "You're all caught up" });

    const previousVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    try {
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(await screen.findByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
    } finally {
      if (previousVisibility) {
        Object.defineProperty(document, 'visibilityState', previousVisibility);
      } else {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'hidden',
        });
      }
    }
  });

  it('disconnects the socket when the component unmounts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(listResponse());
    const { unmount } = render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: "You're all caught up" });
    unmount();
    expect(socketState.disconnect).toHaveBeenCalledOnce();
  });
});
