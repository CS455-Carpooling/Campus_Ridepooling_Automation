import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';
import DashboardPage from './dashboard/page';
import ForgotPasswordPage from './forgot-password/page';
import LoginPage from './login/page';
import RegisterPage from './register/page';
import ResetPasswordPage from './reset-password/page';

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session | null>>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock('@/lib/session', () => ({ getSession }));
vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const params = <T extends Record<string, string>>(value: T) => Promise.resolve(value);

beforeEach(() => {
  getSession.mockReset().mockResolvedValue(null);
  redirect.mockClear();
});

describe('sign-in page', () => {
  it('shows the sign-in form', async () => {
    render(await LoginPage({ searchParams: params({}) } as unknown as PageProps<'/login'>));
    expect(screen.getByRole('button', { name: /Log in/ })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['verified', 'status', 'Email verified.'],
    ['verify_failed', 'alert', 'invalid or has expired'],
  ])('explains the result of a verification link (%s)', async (notice, role, text) => {
    render(await LoginPage({ searchParams: params({ notice }) } as unknown as PageProps<'/login'>));
    expect(screen.getByRole(role)).toHaveTextContent(text);
  });

  it('ignores unknown notices', async () => {
    render(
      await LoginPage({
        searchParams: params({ notice: 'hello' }),
      } as unknown as PageProps<'/login'>),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends signed-in users to their home page', async () => {
    getSession.mockResolvedValue({
      userId: 'u1',
      email: 'ananya@iitk.ac.in',
      displayName: 'Ananya',
      role: 'student',
    });
    await expect(
      LoginPage({ searchParams: params({}) } as unknown as PageProps<'/login'>),
    ).rejects.toThrow('NEXT_REDIRECT /home');
  });
});

describe('registration and password pages', () => {
  it('shows the registration form', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('button', { name: /Create my account/ })).toBeInTheDocument();
  });

  it('asks for the email address to send a reset link to', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole('button', { name: /Send reset link/ })).toBeInTheDocument();
  });

  it('asks for a new password when opened from a reset email', async () => {
    render(
      await ResetPasswordPage({
        searchParams: params({ token: 'raw' }),
      } as unknown as PageProps<'/reset-password'>),
    );
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
  });

  it('sends visitors without a reset token to the forgotten-password page', async () => {
    await expect(
      ResetPasswordPage({ searchParams: params({}) } as unknown as PageProps<'/reset-password'>),
    ).rejects.toThrow('NEXT_REDIRECT /forgot-password');
  });

  it('keeps the old dashboard address working', () => {
    expect(() => DashboardPage()).toThrow('NEXT_REDIRECT /home');
  });
});
