import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';
import { SiteHeader, SiteHeaderSkeleton } from './SiteHeader';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session | null>>(),
}));
vi.mock('@/lib/session', () => ({ getSession }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

describe('SiteHeader', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it('shows the student navigation and who is signed in', async () => {
    getSession.mockResolvedValue({
      userId: 'u1',
      email: 'ananya@example.org',
      displayName: 'Ananya',
      role: 'student',
    });
    render(await SiteHeader());

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Offer a ride' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Ananya')).toBeInTheDocument();
    expect(screen.getByText(/\(Student\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campus Ride-Pooling' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('shows the admin navigation to operations admins', async () => {
    getSession.mockResolvedValue({
      userId: 'a1',
      email: 'khushi@example.org',
      displayName: 'Khushi',
      role: 'admin',
    });
    render(await SiteHeader());

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Incidents' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Offer a ride' })).not.toBeInTheDocument();
    expect(screen.getByText(/\(Operations admin\)/)).toBeInTheDocument();
  });

  it('offers sign-in and registration when nobody is signed in', async () => {
    getSession.mockResolvedValue(null);
    render(await SiteHeader());

    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    const account = screen.getByRole('navigation', { name: 'Account' });
    expect(within(account).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(within(account).getByRole('link', { name: 'Register' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getByRole('link', { name: 'Campus Ride-Pooling' })).toHaveAttribute('href', '/');
  });
});

describe('SiteHeaderSkeleton', () => {
  it('announces that the navigation is loading', () => {
    render(<SiteHeaderSkeleton />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading navigation');
    expect(screen.getByText('Campus Ride-Pooling')).toBeInTheDocument();
  });
});
