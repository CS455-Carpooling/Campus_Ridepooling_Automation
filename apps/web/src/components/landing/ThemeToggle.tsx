'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/PageShells';

const THEME_KEY = 'campus-ride-pooling-theme';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const next = saved ? saved === 'dark' : prefersDark;
    const id = requestAnimationFrame(() => setDark(next));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  const label = `Switch to ${dark ? 'light' : 'dark'} mode`;

  return (
    <button
      className="theme-toggle theme-toggle-global"
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
