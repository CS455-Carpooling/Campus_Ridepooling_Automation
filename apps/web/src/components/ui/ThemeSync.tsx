'use client';

import { useEffect } from 'react';

// Where the theme toggle saves the visitor's choice (src/components/landing/ThemeToggle.tsx).
const THEME_KEY = 'campus-ride-pooling-theme';

/**
 * Pages in the design system have no theme toggle of their own. This applies
 * the choice saved by the toggle, or else the device setting, the same way the
 * toggle does, so the dark tokens in globals.css follow it on these pages too.
 */
export function ThemeSync() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    document.documentElement.classList.toggle('dark', saved ? saved === 'dark' : prefersDark);
  }, []);

  return null;
}
