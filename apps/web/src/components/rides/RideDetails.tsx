import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { RefreshButton } from '@/components/ui/RefreshButton';
import {
  formatDeparture,
  formatDepartureWindow,
  formatRupees,
  formatTimeOfDay,
} from '@/lib/format';
import { campusPlaceLabel, directionLabels, rideTitle } from '@/lib/ride-status';
import type { RideView } from '@/lib/ride-view';
import { routes } from '@/lib/routes';
import { RideStateLabel } from './RideStateLabel';

/**
 * One ride (CS455-29): where and when it goes, its state, seats, fare split
 * and the people on it (FR-RD-03.6, UC-RO-04). It only formats the RideView;
 * every number is worked out on the server (src/lib/ride-view.ts).
 */
export function RideDetails({ ride }: { ride: RideView }) {
  const cancelled = ride.state === 'cancelled';

  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <ButtonLink href={routes.home} variant="quiet" className="px-0">
        Your rides
      </ButtonLink>

      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
          {directionLabels[ride.direction]}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {rideTitle(ride.direction, ride.hub.name)}
        </h1>
        {ride.hub.detail && <p className="mt-1 text-ink-muted">{ride.hub.detail}</p>}
        <p className="mt-4 font-mono text-lg tabular-nums">
          {formatDepartureWindow(ride.departureStart, ride.departureEnd)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <RideStateLabel state={ride.state} />
          <TimingNote ride={ride} />
        </div>
      </header>

      {!cancelled && <SharePanel ride={ride} />}

      <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Fact term="Vehicle">{ride.vehicleName}</Fact>
        <Fact term="Total fare" note="For the whole vehicle, set by the owner">
          <span className="font-mono tabular-nums">{formatRupees(ride.totalFare)}</span>
        </Fact>
        <Fact term="Capacity">
          <span className="font-mono tabular-nums">{ride.capacity}</span> people, owner included
        </Fact>
        <Fact term="Seats">
          <span className="font-mono tabular-nums">{ride.occupantCount}</span> taken,{' '}
          <span className="font-mono tabular-nums">{ride.seatsLeft}</span> free
        </Fact>
      </dl>

      <People ride={ride} showShares={!cancelled} />

      <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-6">
        <p aria-live="polite" className="text-sm text-ink-muted">
          Seats and people as of{' '}
          <time dateTime={ride.readAt} className="font-mono tabular-nums">
            {formatTimeOfDay(ride.readAt)}
          </time>
        </p>
        <RefreshButton />
      </div>
    </DesignSystem>
  );
}

/** When the ride locks, or that its time has passed. Only a scheduled ride has one. */
function TimingNote({ ride }: { ride: RideView }) {
  if (ride.state !== 'scheduled') return null;
  const text = ride.windowEnded
    ? `Departure window ended ${formatDeparture(ride.departureEnd)}`
    : ride.isLocked
      ? `Locked since ${formatDeparture(ride.lockAt)}: the group and shares are fixed`
      : `Locks ${formatDeparture(ride.lockAt)}, an hour before departure`;
  return <p className="text-sm text-ink-muted">{text}</p>;
}

/** The viewer's own share, or what they would pay by joining (FR-RD-08.1). */
function SharePanel({ ride }: { ride: RideView }) {
  let label: string;
  let amount: number | null = null;
  let note: string;

  if (ride.viewerShare !== null) {
    label = 'Your share';
    amount = ride.viewerShare;
    note = ride.isOpen
      ? 'It changes as people join or leave, until the ride locks.'
      : 'The ride is locked, so this share is fixed.';
  } else if (ride.estimatedShare !== null) {
    label = 'Estimated share if you join';
    amount = ride.estimatedShare;
    note = `An estimate: the total fare split between ${ride.occupantCount + 1} people, rounded up to the rupee. Your share is fixed when the ride locks.`;
  } else if (ride.viewerRole === 'visitor' && ride.seatsLeft === 0) {
    label = 'This ride is full';
    note = 'Every seat is taken.';
  } else {
    return null;
  }

  return (
    <section
      data-surface="brand"
      aria-label={label}
      className="mt-8 rounded-panel bg-brand p-5 text-on-brand sm:p-6"
    >
      <p className="text-sm font-semibold text-on-brand-muted">{label}</p>
      {amount !== null && (
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">{formatRupees(amount)}</p>
      )}
      <p className="mt-2 text-sm text-on-brand-muted">{note}</p>
    </section>
  );
}

// No Tailwind `block` class here: src/index.css has its own `.block` (section padding) that wins.
function Fact({ term, note, children }: { term: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="mt-1 font-semibold">
        {children}
        {note && <p className="text-sm font-normal text-ink-muted">{note}</p>}
      </dd>
    </div>
  );
}

/** Everyone on the ride, in the order the fare split counts them (Table T-2). */
function People({ ride, showShares }: { ride: RideView; showShares: boolean }) {
  const placeLabel = campusPlaceLabel(ride.direction);
  const remainder = ride.occupantCount > 0 ? ride.totalFare % ride.occupantCount : 0;

  return (
    <section aria-labelledby="people-heading" className="mt-10">
      <h2 id="people-heading" className="text-xl font-bold tracking-tight">
        People on this ride
      </h2>
      {ride.occupants.length === 0 ? (
        <p className="mt-2 text-ink-muted">Nobody is on this ride yet.</p>
      ) : (
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {ride.occupants.map((person, index) => (
            <li
              key={index}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
            >
              <div>
                <p className="font-semibold">
                  {person.name}
                  {person.isViewer && <span className="font-normal text-ink-muted"> (you)</span>}
                </p>
                <p className="text-sm text-ink-muted">
                  {person.isOwner ? 'Owner' : 'Rider'}, {placeLabel.toLowerCase()} at{' '}
                  {person.campusPlace}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {person.completedTrips} completed {person.completedTrips === 1 ? 'trip' : 'trips'}
                  {person.visibleTags.length > 0 && ` · ${person.visibleTags.join(' · ')}`}
                </p>
              </div>
              {showShares && (
                <p className="font-mono tabular-nums">
                  <span className="sr-only">Share </span>
                  {formatRupees(person.share)}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {showShares && remainder > 0 && (
        <p className="mt-3 text-sm text-ink-muted">
          The fare does not split evenly, so the first {remainder}{' '}
          {remainder === 1 ? 'person pays' : 'people pay'} one rupee more: the owner first, then
          riders in the order they joined.
        </p>
      )}
    </section>
  );
}
