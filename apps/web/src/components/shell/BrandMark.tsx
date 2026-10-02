import { cx } from '@/lib/cx';

/**
 * The product mark: three stops on one route, the first in the accent colour.
 * Decorative; it always sits next to the product name. Same drawing as
 * src/app/icon.svg.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path d="M8 16H24" strokeWidth="2.5" className="stroke-on-brand" />
      <circle cx="8" cy="16" r="3.5" className="fill-accent" />
      <circle cx="16" cy="16" r="3" className="fill-on-brand" />
      <circle cx="24" cy="16" r="3.5" className="fill-on-brand" />
    </svg>
  );
}
