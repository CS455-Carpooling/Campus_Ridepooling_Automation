'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/cx';
import { currentHref, type NavItem } from '@/lib/routes';

/** The main navigation links; the link for the current page is marked for screen readers. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const current = currentHref(usePathname(), items);

  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item) => {
        const isCurrent = item.href === current;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={cx(
                'inline-flex min-h-11 items-center rounded-control px-3 no-underline',
                isCurrent
                  ? 'bg-panel font-semibold text-ink'
                  : 'text-ink-muted hover:bg-panel hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
