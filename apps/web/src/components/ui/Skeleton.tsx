import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * A block standing in for content that is still loading. Give it the size of
 * the content it replaces. Hidden from screen readers; wrap a group of
 * skeletons in LoadingRegion so the loading state is announced once.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cx('animate-skeleton rounded-control bg-line', className)}
      {...props}
    />
  );
}

export type LoadingRegionProps = {
  /** Read out by screen readers while the region loads. */
  label?: string;
  className?: string;
  children: ReactNode;
};

/** Container for skeletons that tells assistive technology the content is loading. */
export function LoadingRegion({ label = 'Loading', className, children }: LoadingRegionProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
