import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatDepartureWindow, formatRupees } from '@/lib/format';
import { campusPlaceLabel, directionLabels } from '@/lib/ride-status';
import type { SearchRideResult } from '@/lib/ride-search';
import { routes } from '@/lib/routes';

/**
 * One search result card. Purely presentational — all numbers are worked out
 * by the server in ride-search.ts. Links to the full ride detail page.
 */
export function RideCard({ ride }: { ride: SearchRideResult }) {
  const placeLabel = campusPlaceLabel(ride.direction);
  const full = ride.seatsLeft === 0;

  return (
    <article className="flex flex-col gap-4 rounded-panel border border-line-strong bg-surface p-5 sm:p-6">
      {/* Header row: direction badge + hub name */}
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
            {directionLabels[ride.direction]}
          </p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight">
            {ride.direction === 'to_hub' ? 'To' : 'From'} {ride.hub.name}
          </h2>
          {ride.hub.detail && <p className="mt-0.5 text-sm text-ink-muted">{ride.hub.detail}</p>}
        </div>

        {/* Seats badge */}
        <span
          className={
            full
              ? 'shrink-0 rounded-control border border-danger px-2.5 py-0.5 text-sm font-semibold text-danger'
              : 'shrink-0 rounded-control border border-line-strong bg-panel px-2.5 py-0.5 text-sm font-semibold text-ink'
          }
        >
          {full ? 'Full' : `${ride.seatsLeft} seat${ride.seatsLeft === 1 ? '' : 's'} left`}
        </span>
      </header>

      {/* Details grid */}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Fact term="Departure">
          <span className="font-mono tabular-nums text-sm">
            {formatDepartureWindow(ride.departureStart, ride.departureEnd)}
          </span>
        </Fact>

        <Fact term="Vehicle">{ride.vehicleName}</Fact>

        <Fact term={placeLabel}>{ride.campusLocationName}</Fact>

        <Fact term="Capacity">
          {ride.occupantCount} / {ride.capacity} people
        </Fact>

        <Fact term="Total fare">
          <span className="font-mono tabular-nums">{formatRupees(ride.totalFare)}</span>
        </Fact>

        <Fact term="Your estimated share">
          <span className="font-mono tabular-nums text-base font-bold">
            {formatRupees(ride.estimatedShare)}
          </span>
          <p className="text-xs text-ink-muted">if accepted</p>
        </Fact>
      </dl>

      {/* People */}
      <div className="border-t border-line pt-3">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{ride.ownerName}</span>
          {ride.occupantNames.length > 1 && (
            <>
              {' '}
              and {ride.occupantNames.length - 1} other
              {ride.occupantNames.length - 1 === 1 ? '' : 's'}
            </>
          )}
        </p>
      </div>

      {/* View button */}
      <Link
        href={routes.ride(ride.id)}
        className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line-strong bg-transparent px-5 text-base font-semibold text-ink hover:bg-panel active:translate-y-px"
      >
        View ride
      </Link>
    </article>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}
