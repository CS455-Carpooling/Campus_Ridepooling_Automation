import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';
import { AppHeader, AppHeaderSkeleton } from './AppHeader';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session | null>>(),
}));
vi.mock('@/lib/session', () => ({ getSession }));
vi.mock('next/navigation', () => ({ usePathname: () => '/home' }));

describe('AppHeader', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it('shows the student navigation and who is signed in', async () => {
    getSession.mockResolvedValue({ userId: 'u1', displayName: 'Ananya', role: 'student' });
    render(await AppHeader());

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Offer a ride' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Ananya')).toBeInTheDocument();
    expect(screen.getByText(/\(Student\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campus Ride-Pooling' })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('shows the admin navigation to operations admins', async () => {
    getSession.mockResolvedValue({ userId: 'a1', displayName: 'Khushi', role: 'admin' });
    render(await AppHeader());

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Incidents' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Offer a ride' })).not.toBeInTheDocument();
    expect(screen.getByText(/\(Operations admin\)/)).toBeInTheDocument();
  });

  it('shows only the product name when nobody is signed in', async () => {
    getSession.mockResolvedValue(null);
    render(await AppHeader());

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campus Ride-Pooling' })).toHaveAttribute('href', '/');
  });
});

describe('AppHeaderSkeleton', () => {
  it('announces that the navigation is loading', () => {
    render(<AppHeaderSkeleton />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading navigation');
    expect(screen.getByText('Campus Ride-Pooling')).toBeInTheDocument();
  });
});
