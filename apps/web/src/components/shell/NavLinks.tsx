'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/cx';
import { currentHref, type NavItem } from '@/lib/routes';

/** The main navigation links; the link for the current page is marked for screen readers. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const current = currentHref(usePathname(), items);

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {items.map((item) => {
        const isCurrent = item.href === current;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={cx(
                isCurrent
                  ? 'font-semibold text-ink underline'
                  : 'text-ink-muted no-underline hover:text-ink hover:underline',
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
