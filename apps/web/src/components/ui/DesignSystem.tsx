import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { ThemeSync } from './ThemeSync';

// Manrope and IBM Plex Mono from Google Fonts, the font host that the site's
// Content-Security-Policy allows (next.config.ts). Both include the rupee sign
// (U+20B9), which fares need.
export const DESIGN_SYSTEM_FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400..800&display=swap';

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
    <div className={cx('ds', className)}>
      {/* React moves this into <head> and loads it once per page. */}
      <link rel="stylesheet" href={DESIGN_SYSTEM_FONTS} precedence="default" />
      <ThemeSync />
      {children}
    </div>
  );
}
