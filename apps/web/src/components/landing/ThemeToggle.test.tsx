import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

const KEY = 'campus-ride-pooling-theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

const media = (matches: boolean) =>
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches })));

describe('ThemeToggle', () => {
  it('starts light when matchMedia is unavailable and nothing is saved', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('follows a dark device preference', () => {
    media(true);
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('prefers the saved choice', () => {
    media(true);
    localStorage.setItem(KEY, 'light');
    render(<ThemeToggle />);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('toggles, updates the label and persists the choice', async () => {
    media(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
