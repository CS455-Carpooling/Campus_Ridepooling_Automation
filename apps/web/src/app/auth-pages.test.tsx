import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentUser, redirect, verifySession, getStudentHome, getAdminHome } = vi.hoisted(
  () => ({
    getCurrentUser: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
    verifySession: vi.fn(),
    getStudentHome: vi.fn(),
    getAdminHome: vi.fn(),
  }),
);

vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/session', () => ({ verifySession }));
vi.mock('@/lib/home-data', () => ({ getStudentHome, getAdminHome }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/components/NextPage', () => ({
  default: (props: { page: string; notice?: string; token?: string; initialEmail?: string }) => (
    <div
      data-testid="next-page"
      data-page={props.page}
      data-notice={props.notice ?? ''}
      data-token={props.token ?? ''}
      data-initial-email={props.initialEmail ?? ''}
    />
  ),
}));

const user = { full_name: 'Ananya Rao', email: 'ananya@iitk.ac.in' };

beforeEach(() => {
  getCurrentUser.mockReset();
  redirect.mockClear();
  verifySession.mockReset();
  getStudentHome.mockReset();
  getAdminHome.mockReset();
  getStudentHome.mockResolvedValue({ upcoming: [], history: [], waiting: [] });
  getAdminHome.mockResolvedValue({
    openIncidents: null,
    complaintsToReview: null,
    recommendationsToDecide: null,
  });
});

describe.each([
  ['login', () => import('./login/page')],
  ['register', () => import('./register/page')],
] as const)('%s page', (name, load) => {
  it('shows the form with the notice when signed out', async () => {
    getCurrentUser.mockResolvedValue(null);
    const { default: Page } = await load();
    render(await Page({ searchParams: Promise.resolve({ notice: 'hello' }) }));
    const el = screen.getByTestId('next-page');
    expect(el).toHaveAttribute('data-page', name);
    expect(el).toHaveAttribute('data-notice', 'hello');
  });

  describe('forgot-password page', () => {
    it('prefills the signed-in account email instead of redirecting away', async () => {
      getCurrentUser.mockResolvedValue({ ...user, email: 'ananya@iitk.ac.in' });
      const { default: Page } = await import('./forgot-password/page');
      render(await Page({ searchParams: Promise.resolve({}) }));
      expect(screen.getByTestId('next-page')).toHaveAttribute('data-page', 'forgot');
      expect(screen.getByTestId('next-page')).toHaveAttribute(
        'data-initial-email',
        'ananya@iitk.ac.in',
      );
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  it('works without a notice', async () => {
    getCurrentUser.mockResolvedValue(null);
    const { default: Page } = await load();
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId('next-page')).toHaveAttribute('data-notice', '');
  });

  it('redirects signed-in users to the dashboard', async () => {
    getCurrentUser.mockResolvedValue(user);
    const { default: Page } = await load();
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/dashboard',
    );
  });
});

describe('reset-password page', () => {
  it('passes the token to the reset form', async () => {
    const { default: Page } = await import('./reset-password/page');
    render(await Page({ searchParams: Promise.resolve({ token: 'abc' }) }));
    expect(screen.getByTestId('next-page')).toHaveAttribute('data-token', 'abc');
    expect(screen.getByTestId('next-page')).toHaveAttribute('data-page', 'reset');
  });

  it('redirects to forgot-password when there is no token', async () => {
    const { default: Page } = await import('./reset-password/page');
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/forgot-password',
    );
  });
});

describe('dashboard page', () => {
  it('shows the student home for signed-in students and includes logout', async () => {
    verifySession.mockResolvedValue({
      userId: 'u1',
      email: 'ananya@iitk.ac.in',
      displayName: 'Ananya',
      role: 'student',
    });
    const { default: Page } = await import('./dashboard/page');
    render(await Page());
    const heading = screen.getByRole('heading', { level: 1, name: 'Your rides' });
    expect(getStudentHome).toHaveBeenCalledWith('u1');
    const logout = screen.getByRole('button', { name: 'Log out' });
    expect(logout.closest('form')).toHaveAttribute('action', '/api/auth/logout');
    expect(heading.parentElement).toContainElement(logout);
  });

  it('redirects to login when signed out', async () => {
    verifySession.mockRejectedValue(new Error('NEXT_REDIRECT /login'));
    const { default: Page } = await import('./dashboard/page');
    await expect(Page()).rejects.toThrow('NEXT_REDIRECT /login');
  });

  it('links to offering a ride from the dashboard', async () => {
    verifySession.mockResolvedValue({
      userId: 'u1',
      email: 'ananya@iitk.ac.in',
      displayName: 'Ananya',
      role: 'student',
    });
    const { default: Page } = await import('./dashboard/page');
    render(await Page());
    expect(screen.getByRole('link', { name: 'Offer a ride' })).toHaveAttribute(
      'href',
      '/rides/new',
    );
    expect(screen.getByRole('link', { name: 'Find a ride' })).toHaveAttribute('href', '/rides');
  });
});
