import Link from 'next/link';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { formatDeparture } from '@/lib/format';
import type { StudentHomeData, UpcomingRide, WaitingRequest } from '@/lib/home-data';
import { routes } from '@/lib/routes';

/** Home page of a student: the entry points for riding and offering rides, then their rides. */
export function StudentHome({ data }: { data: StudentHomeData }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your rides</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={routes.findRide}>Find a ride</ButtonLink>
        <ButtonLink href={routes.offerRide} variant="secondary">
          Offer a ride
        </ButtonLink>
      </div>
      <UpcomingRides rides={data.upcoming} />
      <WaitingRequests requests={data.waiting} />
    </div>
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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Departure
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Destination
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Your part
                </th>
                <th scope="col" className="py-2 font-medium">
                  Seats left
                </th>
              </tr>
            </thead>
            <tbody>
              {rides.map((ride) => (
                <tr key={ride.rideId} className="border-b border-line">
                  <td className="py-2 pr-4 font-mono whitespace-nowrap tabular-nums">
                    {formatDeparture(ride.departure)}
                  </td>
                  <td className="py-2 pr-4">
                    <Link href={routes.ride(ride.rideId)}>{ride.destination}</Link>
                  </td>
                  <td className="py-2 pr-4">{ride.part === 'owner' ? 'Owner' : 'Rider'}</td>
                  <td className="py-2 font-mono tabular-nums">{ride.seatsLeft}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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
