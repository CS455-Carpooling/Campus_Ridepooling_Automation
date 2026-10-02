import Link from 'next/link';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { roleLabels } from '@/lib/roles';
import { navigationFor, routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { BrandMark } from './BrandMark';
import { NavLinks } from './NavLinks';

const productName = 'Campus Ride-Pooling';

const headerRow =
  'mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6';

function Wordmark({ href }: { href?: string }) {
  const content = (
    <>
      <BrandMark />
      {productName}
    </>
  );
  const className = 'flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-ink';
  return href ? (
    <Link href={href} className={`${className} no-underline`}>
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}

/**
 * Header of every page. Signed in, it shows the navigation for the user's role
 * and who is signed in; signed out, the links to sign in or register. It only
 * displays the session: pages that need a signed-in user check it themselves
 * with verifySession().
 */
export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-line">
      <div className={headerRow}>
        <Wordmark href={session ? routes.home : routes.landing} />
        {session ? (
          <>
            <nav aria-label="Main">
              <NavLinks items={navigationFor(session.role)} />
            </nav>
            <p className="text-sm text-ink-muted sm:ml-auto">
              <span className="font-semibold text-ink">{session.displayName}</span> (
              {roleLabels[session.role]})
            </p>
          </>
        ) : (
          <nav aria-label="Account" className="ml-auto">
            <ul className="flex items-center gap-2">
              <li>
                <Link
                  href={routes.login}
                  className="inline-flex min-h-11 items-center rounded-control px-3 font-semibold text-ink no-underline hover:bg-panel"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <ButtonLink href={routes.register}>Register</ButtonLink>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}

/** Shown while the header waits for the session. */
export function SiteHeaderSkeleton() {
  return (
    <header className="border-b border-line">
      <div className={headerRow}>
        <Wordmark />
        <LoadingRegion label="Loading navigation" className="ml-auto flex gap-3">
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-28" />
        </LoadingRegion>
      </div>
    </header>
  );
}
