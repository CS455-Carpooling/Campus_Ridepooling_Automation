import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { ThemeSync } from './ThemeSync';

// Self-hosted by next/font; latin-ext carries the rupee sign (U+20B9), which fares need.
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-ds-sans',
});

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-ds-mono',
});

export type DesignSystemProps = {
  className?: string;
  children: ReactNode;
};

/**
 * Opts a page into the design system: the forest-and-coral tokens in
 * src/app/globals.css, Manrope and IBM Plex Mono, in the theme the visitor
 * chose. Pages outside it keep the site styles of src/index.css. Wrap the
 * page's outermost element only.
 */
export function DesignSystem({ className, children }: DesignSystemProps) {
  return (
    <div className={cx('ds', manrope.variable, plexMono.variable, className)}>
      <ThemeSync />
      {children}
    </div>
  );
}
