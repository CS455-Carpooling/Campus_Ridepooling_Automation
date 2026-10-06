import type { ReactNode } from 'react';
import Link from 'next/link';
import { RideStateLabel } from '@/components/rides/RideStateLabel';
import { formatDepartureWindow, formatRupees } from '@/lib/format';
import { campusPlaceLabel } from '@/lib/ride-status';
import type { HistoricalRide } from '@/lib/home-data';
import { routes } from '@/lib/routes';

export function RideHistoryList({ rides }: { rides: HistoricalRide[] }) {
  if (rides.length === 0) {
    return (
      <p className="mt-6 text-ink-muted">
        Completed, cancelled, and past rides you offered or joined will appear here.
      </p>
    );
  }

  return (
    <ul aria-label="Ride history" className="mt-6 divide-y divide-line border-y border-line">
      {rides.map((ride) => (
        <li key={ride.rideId} className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Link
              href={routes.ride(ride.rideId)}
              className="inline-flex min-h-11 items-center font-semibold"
            >
              {ride.title}
            </Link>
            <RideStateLabel state={ride.state} />
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <HistoryFact label="Departure">
              {formatDepartureWindow(ride.departureStart, ride.departureEnd)}
            </HistoryFact>
            <HistoryFact label="Your part">{ride.part === 'owner' ? 'Owner' : 'Rider'}</HistoryFact>
            <HistoryFact label={campusPlaceLabel(ride.direction)}>{ride.campusPlace}</HistoryFact>
            <HistoryFact label="Vehicle">{ride.vehicleName}</HistoryFact>
            <HistoryFact label="Total fare">{formatRupees(ride.totalFare)}</HistoryFact>
            <HistoryFact label="People">
              {ride.occupantCount} of {ride.capacity}
            </HistoryFact>
          </dl>
          <Link
            href={routes.ride(ride.rideId)}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold"
          >
            View all ride details
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HistoryFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
