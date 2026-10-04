import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { DesignSystemFonts } from './DesignSystemFonts';
import { ThemeSync } from './ThemeSync';

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
      <DesignSystemFonts />
      <ThemeSync />
      {children}
    </div>
  );
}
