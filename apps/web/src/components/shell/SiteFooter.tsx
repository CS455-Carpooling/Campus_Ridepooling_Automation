import Link from 'next/link';
import { routes } from '@/lib/routes';

/** Footer with the legal pages, which every page of the site links to. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-6 text-sm text-ink-muted">
        <p>Campus Ride-Pooling is a CS455 course project at IIT Kanpur.</p>
        <nav aria-label="Legal" className="sm:ml-auto">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li>
              <Link href={routes.terms}>Terms of service</Link>
            </li>
            <li>
              <Link href={routes.privacy}>Privacy policy</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
