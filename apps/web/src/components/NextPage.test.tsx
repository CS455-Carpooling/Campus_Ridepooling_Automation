import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NextPage from './NextPage';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

function mockMedia(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({ matches: prefersDark })),
  );
}

beforeEach(() => {
  router.push.mockReset();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  mockMedia(false);
});
afterEach(() => vi.unstubAllGlobals());

describe('NextPage theme', () => {
  it('follows the device preference when nothing is saved', () => {
    mockMedia(true);
    render(<NextPage page="home" />);
    expect(document.documentElement).toHaveClass('dark');
  });

  it('stays light when the device is light and nothing is saved', () => {
    render(<NextPage page="home" />);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('prefers the saved choice over the device preference', () => {
    mockMedia(true);
    localStorage.setItem('campus-ride-pooling-theme', 'light');
    render(<NextPage page="home" />);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('applies a saved dark choice', () => {
    localStorage.setItem('campus-ride-pooling-theme', 'dark');
    render(<NextPage page="home" />);
    expect(document.documentElement).toHaveClass('dark');
  });

  it('toggles and persists the theme', async () => {
    const user = userEvent.setup();
    render(<NextPage page="home" />);
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(localStorage.getItem('campus-ride-pooling-theme')).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(localStorage.getItem('campus-ride-pooling-theme')).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

describe('NextPage navigation', () => {
  it('renders the landing page for "home" and navigates from it', async () => {
    const user = userEvent.setup();
    render(<NextPage page="home" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Own the journey.');

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(router.push).toHaveBeenLastCalledWith('/login');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    await user.click(screen.getByRole('button', { name: /Join the ride/ }));
    expect(router.push).toHaveBeenLastCalledWith('/register');

    await user.click(screen.getAllByRole('button', { name: 'Go to home' })[0]);
    expect(router.push).toHaveBeenLastCalledWith('/');
  });

  it('renders the auth page with notice and navigates between auth pages', async () => {
    const user = userEvent.setup();
    render(<NextPage page="login" notice="verified" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email verified. You can log in now.');

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(router.push).toHaveBeenLastCalledWith('/forgot-password');
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(router.push).toHaveBeenLastCalledWith('/register');
  });

  it('goes back to login from the reset page', async () => {
    const user = userEvent.setup();
    render(<NextPage page="reset" token="tok" />);
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(router.push).toHaveBeenLastCalledWith('/login');
  });
});
