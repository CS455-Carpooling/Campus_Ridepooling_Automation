import Link from 'next/link';
import { formatDeparture, formatClockTime } from '@/lib/format';
import type { RideOccupant, RideView } from '@/lib/ride-view';
import { routes } from '@/lib/routes';
import { seatStatusLabels } from '@/lib/trip-rules';
import { ArrivalControls, CheckInButton } from './ArrivalControls';
import { TripActionButton } from './TripActionButton';

/**
 * The trip on the ride page (CS455-63: FR-RO-09, FR-RO-10, FR-RD-10). The owner runs it from
 * TripPanel: start pickup once the ride is locked, mark each rider, start the trip and complete
 * the ride. Everyone else follows it in TripStatus. Both list the stops in order with estimated
 * times; every number comes from the server (src/lib/ride-view.ts).
 */

const tripUrl = (ride: RideView, path: string) =>
  `/api/rides/${encodeURIComponent(ride.id)}/${path}`;

export function TripPanel({ ride }: { ride: RideView }) {
  const trip = ride.trip;
  if (!trip) return null;
  const riders = ride.occupants.filter((person) => !person.isOwner);
  const unmarked = riders.filter(
    (person) => person.status === 'waiting' || person.status === 'checked_in',
  );

  return (
    <section aria-labelledby="trip-heading" className="mt-8">
      <h2 id="trip-heading" className="text-xl font-bold tracking-tight">
        Run the trip
      </h2>

      {ride.state === 'scheduled' && trip.canStartPickup && (
        <div className="mt-3">
          <TripActionButton
            label="Start pickup"
            question="Start pickup now?"
            detail={
              <p>
                Everyone on the ride is told that pickup has started. Then mark each rider as they
                get in.
              </p>
            }
            confirm="Yes, start pickup"
            busy="Starting pickup…"
            hint="The ride is locked, so the group is fixed."
            url={tripUrl(ride, 'trip')}
            body={{ to: 'pickup_in_progress' }}
            variant="primary"
            failure="Unable to start pickup right now."
          />
        </div>
      )}

      <Stops ride={ride} controls={ride.state === 'pickup_in_progress'} />

      <div className="mt-6 flex flex-col gap-4">
        {trip.canStartTrip && (
          <TripActionButton
            label="Start the trip"
            question="Has everyone got in?"
            detail={
              unmarked.length > 0 ? (
                <p>
                  Not marked yet: {unmarked.map((person) => person.name).join(', ')}. They will be
                  counted as on board. Mark anyone who did not come as a no-show first.
                </p>
              ) : (
                <p>Everyone is marked. The ride then shows as in transit.</p>
              )
            }
            confirm="Yes, start the trip"
            busy="Starting the trip…"
            url={tripUrl(ride, 'trip')}
            body={{ to: 'in_transit' }}
            variant="primary"
            failure="Unable to start the trip right now."
          />
        )}
        {ride.canComplete && (
          <TripActionButton
            label="Complete the ride"
            question="Complete this ride?"
            detail={
              <p>
                The final shares are saved, everyone on the ride can rate each other for 72 hours,
                and the ride moves to your history. A completed ride cannot be reopened.
              </p>
            }
            confirm="Yes, complete it"
            busy="Completing…"
            hint="Once everyone has reached the destination."
            url={tripUrl(ride, 'complete')}
            failure="Unable to complete the ride right now."
          />
        )}
      </div>
    </section>
  );
}

export function TripStatus({ ride }: { ride: RideView }) {
  const trip = ride.trip;
  if (!trip) return null;
  const me = ride.occupants.find((person) => person.isViewer);

  if (trip.viewerNoShow) {
    return (
      <section aria-labelledby="trip-heading" className="mt-8">
        <h2 id="trip-heading" className="text-xl font-bold tracking-tight">
          Your trip
        </h2>
        <p className="mt-2">
          The owner marked you as a no-show, so you are no longer on this ride and owe nothing for
          it.
        </p>
        {ride.canComplain && (
          <p className="mt-2 text-sm text-ink-muted">
            If that is wrong,{' '}
            <Link href={routes.rideComplaint(ride.id)} className="font-semibold text-ink">
              report it
            </Link>{' '}
            within 7 days.
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="trip-heading" className="mt-8">
      <h2 id="trip-heading" className="text-xl font-bold tracking-tight">
        Your trip
      </h2>
      <p className="mt-2">{summary(ride, me)}</p>
      {trip.canCheckIn && <CheckInButton rideId={ride.id} />}
      {me?.status === 'checked_in' && (
        <p className="mt-2 text-sm text-ink-muted">
          You said you are at your pickup point. The owner marks you when you get in.
        </p>
      )}
      <Stops ride={ride} controls={false} />
    </section>
  );
}

/** One line on where the trip is, for the people on it. */
function summary(ride: RideView, me: RideOccupant | undefined): string {
  const trip = ride.trip!;
  if (ride.state === 'in_transit' && trip.tripStartedAt) {
    return `On the way since ${formatDeparture(trip.tripStartedAt)}.`;
  }
  const yourPickup =
    me && trip.viewerPickupAt
      ? ` Be at ${me.campusPlace} by about ${formatClockTime(trip.viewerPickupAt)}.`
      : '';
  if (ride.state === 'pickup_in_progress' && trip.pickupStartedAt) {
    const marked = me?.status === 'arrived' ? ' The owner has marked you as on board.' : yourPickup;
    return `Pickup started ${formatDeparture(trip.pickupStartedAt)}.${marked}`;
  }
  return `Pickup has not started yet.${yourPickup}`;
}

/** The stops in order (FR-RD-10.2), with the owner's buttons for each rider during pickup. */
function Stops({ ride, controls }: { ride: RideView; controls: boolean }) {
  const trip = ride.trip!;
  const seats = new Map(ride.occupants.map((person) => [person.occupantId, person]));
  const pickup = trip.stopKind === 'pickup';

  return (
    <div className="mt-5">
      <h3 className="font-semibold">{pickup ? 'Pickup order' : 'Drop-off order'}</h3>
      <p className="text-sm text-ink-muted">
        {pickup
          ? 'Times are estimates from campus travel times.'
          : `Everyone gets in at ${ride.hub.name}; this is the order people get out on campus.`}
      </p>
      <ol
        aria-label={pickup ? 'Pickup order' : 'Drop-off order'}
        className="mt-2 divide-y divide-line border-y border-line"
      >
        {trip.stops.map((stop, index) => (
          <li key={stop.place} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p className="font-semibold">
                {index + 1}. {stop.place}
              </p>
              {pickup && (
                <p className="font-mono text-sm tabular-nums text-ink-muted">
                  {stop.estimatedAt ? `About ${formatClockTime(stop.estimatedAt)}` : 'Time unknown'}
                </p>
              )}
            </div>
            <ul className="mt-1 space-y-2">
              {stop.occupantIds.map((occupantId) => {
                const person = seats.get(occupantId);
                if (!person) return null;
                return (
                  <li
                    key={occupantId}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                  >
                    <p>
                      {person.name}
                      {person.isViewer && <span className="text-ink-muted"> (you)</span>}
                      <span className="text-sm text-ink-muted">
                        {' · '}
                        {person.isOwner ? 'Owner' : seatStatusLabels[person.status]}
                      </span>
                    </p>
                    {controls && !person.isOwner && (
                      <ArrivalControls rideId={ride.id} person={person} />
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
