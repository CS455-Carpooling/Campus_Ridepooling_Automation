import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeSync } from './ThemeSync';

const THEME_KEY = 'campus-ride-pooling-theme';

function deviceSetting(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: dark && query === '(prefers-color-scheme: dark)' })),
  );
}

const isDark = () => document.documentElement.classList.contains('dark');

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeSync', () => {
  it('applies a saved dark choice', () => {
    deviceSetting(false);
    localStorage.setItem(THEME_KEY, 'dark');
    render(<ThemeSync />);
    expect(isDark()).toBe(true);
  });

  it('keeps a saved light choice on a dark device', () => {
    deviceSetting(true);
    localStorage.setItem(THEME_KEY, 'light');
    document.documentElement.classList.add('dark');
    render(<ThemeSync />);
    expect(isDark()).toBe(false);
  });

  it('follows the device setting when nothing is saved', () => {
    deviceSetting(true);
    render(<ThemeSync />);
    expect(isDark()).toBe(true);
  });

  it('stays light when nothing is saved and the browser cannot tell', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<ThemeSync />);
    expect(isDark()).toBe(false);
  });

  it('renders nothing', () => {
    const { container } = render(<ThemeSync />);
    expect(container).toBeEmptyDOMElement();
  });
});
