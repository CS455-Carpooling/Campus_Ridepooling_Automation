import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RideCard } from '@/components/rides/RideCard';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getCurrentUser } from '@/lib/auth';
import { searchRides } from '@/lib/ride-search';
import { parseSearchRequest } from '@/lib/ride-search-rules';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Ride results' };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * /rides/results: server component that reads the search params put there by
 * SearchRideForm's router.push, fetches results directly (no API hop needed),
 * and renders them. loading.tsx fires the instant Next.js starts rendering this.
 */
export default async function RideResultsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  // The URL can be edited by hand: anything missing or invalid goes back to the search form
  // rather than reaching the database.
  const filters = parseSearchRequest(await searchParams);
  if (!filters) redirect(routes.findRide);

  const rides = await searchRides(user.id, filters);

  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
          Find a ride
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {rides.length === 0 ? 'No rides found' : 'Available rides'}
        </h1>
        <p className="mt-2 text-ink-muted">
          {rides.length === 0
            ? 'No open rides match your filters.'
            : `${rides.length} ride${rides.length === 1 ? '' : 's'} match your search.`}
        </p>
      </header>

      {rides.length === 0 ? (
        <div className="mt-8">
          <p className="text-ink-muted">
            Try widening your departure window or removing optional filters.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <ButtonLink href={routes.findRide} variant="secondary">
              ← Back to search
            </ButtonLink>
            <ButtonLink href={routes.offerRide} variant="primary">
              Offer your own ride
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <ol className="mt-8 flex flex-col gap-6" aria-label="Search results">
            {rides.map((ride) => (
              <li key={ride.id}>
                <RideCard ride={ride} />
              </li>
            ))}
          </ol>
          <div className="mt-8 border-t border-line pt-6">
            <ButtonLink href={routes.findRide} variant="secondary">
              ← Back to search
            </ButtonLink>
          </div>
        </>
      )}
    </DesignSystem>
  );
}
