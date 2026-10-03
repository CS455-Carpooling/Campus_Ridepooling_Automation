import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * A message above or in place of a form. Errors are announced at once
 * (role="alert"); confirmations politely (role="status").
 */
export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-control border bg-panel px-4 py-3 text-sm',
        tone === 'error' ? 'border-danger text-danger' : 'border-line-strong text-ink',
      )}
    >
      {children}
    </p>
  );
}
