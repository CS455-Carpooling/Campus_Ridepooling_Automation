import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentUser, redirect } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/components/NextPage', () => ({
  default: (props: { page: string; notice?: string; token?: string }) => (
    <div
      data-testid="next-page"
      data-page={props.page}
      data-notice={props.notice ?? ''}
      data-token={props.token ?? ''}
    />
  ),
}));

const user = { full_name: 'Ananya Rao', email: 'ananya@iitk.ac.in' };

beforeEach(() => {
  getCurrentUser.mockReset();
  redirect.mockClear();
});

describe.each([
  ['login', () => import('./login/page')],
  ['register', () => import('./register/page')],
  ['forgot', () => import('./forgot-password/page')],
] as const)('%s page', (name, load) => {
  it('shows the form with the notice when signed out', async () => {
    getCurrentUser.mockResolvedValue(null);
    const { default: Page } = await load();
    render(await Page({ searchParams: Promise.resolve({ notice: 'hello' }) }));
    const el = screen.getByTestId('next-page');
    expect(el).toHaveAttribute('data-page', name);
    expect(el).toHaveAttribute('data-notice', 'hello');
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
  it('greets the signed-in user by first name', async () => {
    getCurrentUser.mockResolvedValue(user);
    const { default: Page } = await import('./dashboard/page');
    render(await Page());
    expect(screen.getByRole('heading', { name: 'Hi, Ananya' })).toBeInTheDocument();
    expect(screen.getByText(/ananya@iitk\.ac\.in/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('redirects to login when signed out', async () => {
    getCurrentUser.mockResolvedValue(null);
    const { default: Page } = await import('./dashboard/page');
    await expect(Page()).rejects.toThrow('REDIRECT:/login');
  });
});
