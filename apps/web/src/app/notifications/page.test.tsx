import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { verifySession } from '@/lib/session';
import NotificationsPage from './page';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/notifications/NotificationsCentre', () => ({
  NotificationsCentre: () => <div>Notifications content</div>,
}));

describe('NotificationsPage', () => {
  it('verifies the session before rendering the notifications centre', async () => {
    const page = await NotificationsPage();

    render(page);

    expect(verifySession).toHaveBeenCalledOnce();
    expect(screen.getByText('Notifications content')).toBeInTheDocument();
  });
});
