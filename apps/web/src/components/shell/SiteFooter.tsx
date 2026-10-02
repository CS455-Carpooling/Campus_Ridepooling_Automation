import Link from 'next/link';
import { routes } from '@/lib/routes';
import { BrandMark } from './BrandMark';

/** Footer with the legal pages, which every page of the site links to. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-x-10 gap-y-6 px-4 py-10 sm:px-6">
        <div>
          <p className="flex items-center gap-2.5 font-extrabold tracking-tight">
            <BrandMark className="size-7" />
            Campus Ride-Pooling
          </p>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            A CS455 software engineering course project at IIT Kanpur.
          </p>
        </div>
        <nav aria-label="Legal" className="sm:ml-auto">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
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
