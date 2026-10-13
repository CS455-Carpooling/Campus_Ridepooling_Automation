'use client';

import { Button } from '@/components/ui/Button';
import { formatClockTime } from '@/lib/format';
import type { RideOccupant } from '@/lib/ride-view';
import { TripActionButton } from './TripActionButton';
import { useNow, useTripRequest } from './trip-hooks';

/**
 * The owner's buttons for one rider during pickup (CS455-63: FR-RO-09.3, FR-RO-10.1): Arrived, or
 * Undo arrived, and No-show, which is offered from 5 minutes after the rider's estimated pickup
 * time and asks first, because it cannot be undone.
 */
export function ArrivalControls({ rideId, person }: { rideId: string; person: RideOccupant }) {
  const { send, busy, error } = useTripRequest();
  const now = useNow(5000);
  const url = `/api/rides/${encodeURIComponent(rideId)}/arrivals`;

  if (person.status === 'no_show' || person.status === 'left') return null;
  const arrived = person.status === 'arrived';
  const noShowAt = person.noShowAvailableAt;
  const noShowOpen = noShowAt !== null && now.getTime() >= new Date(noShowAt).getTime();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {arrived ? (
        <Button
          variant="quiet"
          disabled={busy}
          aria-label={`Undo arrived for ${person.name}`}
          onClick={() => send(url, { occupantId: person.occupantId, status: 'not_arrived' })}
        >
          Undo arrived
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={busy}
          aria-label={`${person.name} arrived`}
          onClick={() => send(url, { occupantId: person.occupantId, status: 'arrived' })}
        >
          Arrived
        </Button>
      )}
      {!arrived &&
        noShowAt !== null &&
        (noShowOpen ? (
          <TripActionButton
            label="No-show"
            ariaLabel={`${person.name} is a no-show`}
            question={`Mark ${person.name} as a no-show?`}
            detail={
              <p>
                They leave this ride and owe nothing, and the fare is split again between the rest
                of you. They are told, and can report it if it is wrong. This cannot be undone.
              </p>
            }
            confirm="Yes, mark as a no-show"
            busy="Marking as a no-show…"
            url={url}
            body={{ occupantId: person.occupantId, status: 'no_show' }}
            failure="Unable to mark the no-show right now."
          />
        ) : (
          <p className="text-sm text-ink-muted">
            No-show from{' '}
            <time dateTime={noShowAt} className="font-mono tabular-nums">
              {formatClockTime(noShowAt)}
            </time>
          </p>
        ))}
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A rider says they are at their pickup point, which everyone on the ride sees (FR-RD-10.4). */
export function CheckInButton({ rideId }: { rideId: string }) {
  const { send, busy, error } = useTripRequest();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => send(`/api/rides/${encodeURIComponent(rideId)}/check-in`)}
      >
        I am at the pickup point
      </Button>
      <p className="text-sm text-ink-muted">Everyone on the ride sees it.</p>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
