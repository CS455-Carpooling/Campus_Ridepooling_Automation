import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RideCard } from '@/components/rides/RideCard';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getCurrentUser } from '@/lib/auth';
import { searchRides, type SearchRideRequest } from '@/lib/ride-search';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Ride results' };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getString(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function getOptionalInt(value: string | string[] | undefined): number | undefined {
  const s = getString(value);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * /rides/results — server component that reads the search params put there by
 * SearchRideForm's router.push, fetches results directly (no API hop needed),
 * and renders them. loading.tsx fires the instant Next.js starts rendering this.
 */
export default async function RideResultsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const params = await searchParams;

  const direction = getString(params.direction);
  const hubId = getString(params.hubId);
  const campusLocationId = getString(params.campusLocationId);
  const departureStart = getString(params.departureStart);
  const departureEnd = getString(params.departureEnd);
  const vehicleTypeId = getString(params.vehicleTypeId) || undefined;
  const maxFareShare = getOptionalInt(params.maxFareShare);

  // If required params are missing (user navigated here directly without the
  // form), send them back to the search page.
  if (!direction || !hubId || !campusLocationId || !departureStart || !departureEnd) {
    redirect(routes.findRide);
  }

  const filters: SearchRideRequest = {
    direction: direction as 'to_hub' | 'from_hub',
    hubId,
    campusLocationId,
    departureStart,
    departureEnd,
    vehicleTypeId,
    maxFareShare,
  };

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
