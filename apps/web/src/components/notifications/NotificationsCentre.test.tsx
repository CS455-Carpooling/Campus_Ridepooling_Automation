import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsCentre } from './NotificationsCentre';

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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('NotificationsCentre', () => {
  it('shows a loading state while retrieving notifications', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    render(<NotificationsCentre />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading notifications');
  });

  it('shows an empty state when there are no notifications', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ notifications: [], pagination: { hasMore: false } }),
    );
    render(<NotificationsCentre />);
    expect(
      await screen.findByRole('heading', { name: "You're all caught up" }),
    ).toBeInTheDocument();
  });

  it('shows notification content, timestamp, unread state and a valid ride link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ notifications: [notification], pagination: { hasMore: false } }),
    );
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

  it('marks a notification read only after the API confirms and reflects persisted state', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({ notifications: [notification], pagination: { hasMore: false } }),
      )
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
  });

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
      .mockResolvedValueOnce(
        Response.json({ notifications: [notification], pagination: { hasMore: false } }),
      )
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        notifications,
        pagination: { hasMore: false },
      }),
    );

    render(<NotificationsCentre />);

    for (const type of additionalTypes) {
      expect(await screen.findByRole('heading', { name: `Notice: ${type}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps notifications visible when the API adds an unknown type', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        notifications: [
          notification,
          {
            ...notification,
            id: 'n-trip',
            type: 'trip_update',
            title: 'Trip updated',
            relatedRideId: null,
          },
        ],
        pagination: { hasMore: false },
      }),
    );

    render(<NotificationsCentre />);

    expect(await screen.findByRole('heading', { name: 'Ride updated' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Trip updated' })).toBeInTheDocument();
    expect(screen.queryByText('The notifications response was invalid.')).not.toBeInTheDocument();
  });

  it('does not link malformed related ride identifiers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        notifications: [
          { ...notification, relatedRideId: 'not-a-uuid', relatedChatId: 'stale-chat' },
        ],
        pagination: { hasMore: false },
      }),
    );
    render(<NotificationsCentre />);
    await screen.findByRole('heading', { name: 'Ride updated' });
    expect(screen.queryByRole('link', { name: 'View related ride' })).not.toBeInTheDocument();
  });
});
