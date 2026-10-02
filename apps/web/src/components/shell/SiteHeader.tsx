import Link from 'next/link';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { roleLabels } from '@/lib/roles';
import { navigationFor, routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { NavLinks } from './NavLinks';

const productName = 'Campus Ride-Pooling';

/**
 * Header of the signed-in app: the product name, the navigation for the
 * user's role and who is signed in. It only displays the session; each page
 * still checks access itself with verifySession().
 */
export async function AppHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
        <Link
          href={session ? routes.home : routes.landing}
          className="font-semibold text-ink no-underline"
        >
          {productName}
        </Link>
        {session && (
          <>
            <nav aria-label="Main">
              <NavLinks items={navigationFor(session.role)} />
            </nav>
            <p className="text-sm text-ink-muted sm:ml-auto">
              <span className="text-ink">{session.displayName}</span> ({roleLabels[session.role]})
            </p>
          </>
        )}
      </div>
    </header>
  );
}

/** Shown while the header waits for the session. */
export function AppHeaderSkeleton() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
        <span className="font-semibold">{productName}</span>
        <LoadingRegion label="Loading navigation" className="flex gap-5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </LoadingRegion>
      </div>
    </header>
  );
}
