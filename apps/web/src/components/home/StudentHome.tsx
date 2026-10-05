import Link from 'next/link';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { formatDeparture } from '@/lib/format';
import type { StudentHomeData, UpcomingRide, WaitingRequest } from '@/lib/home-data';
import { routes } from '@/lib/routes';
import { RideStateLabel } from '@/components/rides/RideStateLabel';
import { DesignSystem } from '@/components/ui/DesignSystem';

/** Home page of a student: the entry points for riding and offering rides, then their rides. */
export function StudentHome({ data }: { data: StudentHomeData }) {
  return (
    <DesignSystem className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your rides</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={routes.findRide}>Find a ride</ButtonLink>
        <ButtonLink href={routes.offerRide} variant="secondary">
          Offer a ride
        </ButtonLink>
      </div>
      <UpcomingRides rides={data.upcoming} />
      <WaitingRequests requests={data.waiting} />
    </DesignSystem>
  );
}

function UpcomingRides({ rides }: { rides: UpcomingRide[] }) {
  return (
    <section aria-labelledby="upcoming-heading" className="mt-10">
      <h2 id="upcoming-heading" className="text-xl font-bold tracking-tight">
        Upcoming
      </h2>
      {rides.length === 0 ? (
        <p className="mt-2 text-ink-muted">
          No upcoming rides. Rides you join or offer will be listed here.
        </p>
      ) : (
        <ul aria-label="Upcoming rides" className="mt-3 divide-y divide-line border-y border-line">
          {rides.map((ride) => (
            <li key={ride.rideId} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-x-4">
                <Link
                  href={routes.ride(ride.rideId)}
                  className="inline-flex min-h-11 items-center font-semibold"
                >
                  {ride.title}
                </Link>
                <span className="text-sm text-ink-muted">
                  <span className="sr-only">Your part: </span>
                  {ride.part === 'owner' ? 'Owner' : 'Rider'}
                </span>
              </div>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm text-ink-muted">
                <span className="font-mono text-ink tabular-nums">
                  {formatDeparture(ride.departure)}
                </span>
                <span>{seatsLeftText(ride.seatsLeft)}</span>
                {ride.state !== 'scheduled' && <RideStateLabel state={ride.state} />}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function seatsLeftText(seatsLeft: number): string {
  if (seatsLeft === 0) return 'Full';
  return `${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left`;
}

function WaitingRequests({ requests }: { requests: WaitingRequest[] }) {
  return (
    <section aria-labelledby="waiting-heading" className="mt-10">
      <h2 id="waiting-heading" className="text-xl font-bold tracking-tight">
        Waiting for a decision
      </h2>
      {requests.length === 0 ? (
        <p className="mt-2 text-ink-muted">Nothing is waiting for a decision.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {requests.map((request) => {
            const ride = <Link href={routes.ride(request.rideId)}>{request.destination}</Link>;
            const when = (
              <span className="font-mono tabular-nums">{formatDeparture(request.departure)}</span>
            );
            return (
              <li key={request.requestId} className="py-3">
                {request.kind === 'sent' ? (
                  <>
                    Your request for the ride to {ride} on {when} is waiting for the ride owner.
                  </>
                ) : (
                  <>
                    {request.riderName} asked to join your ride to {ride} on {when}.
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
