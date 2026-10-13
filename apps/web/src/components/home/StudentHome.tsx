'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { formatDeparture } from '@/lib/format';
import type {
  RequestStatus,
  RiderJoinRequest,
  StudentHomeData,
  UpcomingRide,
  WaitingRequest,
} from '@/lib/home-data';
import { routes } from '@/lib/routes';
import { RideStateLabel } from '@/components/rides/RideStateLabel';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { DashboardTabs } from './DashboardTabs';
import { RideHistoryList } from './RideHistoryList';

export function StudentHome({ data }: { data: StudentHomeData }) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

  // Older tests and callers may not provide this new field yet.
  const joinRequests = data.joinRequests ?? [];

  return (
    <DesignSystem className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {activeTab === 'upcoming' ? 'Your rides' : 'Ride history'}
        </h1>

        <div className="flex flex-wrap gap-3">
          <ButtonLink href={routes.myComplaints} variant="secondary">
            Your complaints
          </ButtonLink>
          <ButtonLink href={routes.profile} variant="secondary">
            Profile
          </ButtonLink>
          <LogoutButton />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={routes.findRide}>Find a ride</ButtonLink>
        <ButtonLink href={routes.offerRide} variant="secondary">
          Offer a ride
        </ButtonLink>
      </div>

      <DashboardTabs current={activeTab} onChange={setActiveTab} />

      <div
        id="upcoming-panel"
        role="tabpanel"
        aria-labelledby="upcoming-tab"
        hidden={activeTab !== 'upcoming'}
      >
        <UpcomingRides rides={data.upcoming} />
        <WaitingRequests requests={data.waiting} joinRequests={joinRequests} />
      </div>

      <div
        id="history-panel"
        role="tabpanel"
        aria-labelledby="history-tab"
        hidden={activeTab !== 'history'}
      >
        <RideHistoryList rides={data.history} />
        <JoinRequestHistory requests={joinRequests} />
      </div>
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

function WaitingRequests({
  requests,
  joinRequests,
}: {
  requests: WaitingRequest[];
  joinRequests: RiderJoinRequest[];
}) {
  const pendingRequests = joinRequests.filter(
    (request) => request.status === 'pending' || request.status === 'needs_reconfirmation',
  );

  return (
    <section aria-labelledby="waiting-heading" className="mt-10">
      <h2 id="waiting-heading" className="text-xl font-bold tracking-tight">
        Waiting for a decision
      </h2>

      {requests.length === 0 && pendingRequests.length === 0 ? (
        <p className="mt-2 text-ink-muted">Nothing is waiting for a decision.</p>
      ) : (
        <ul
          aria-label="Waiting requests"
          className="mt-3 divide-y divide-line border-y border-line"
        >
          {requests.map((request) => {
            const ride = <Link href={routes.ride(request.rideId)}>{request.destination}</Link>;

            const when = (
              <span className="font-mono tabular-nums">{formatDeparture(request.departure)}</span>
            );

            return (
              <li key={request.requestId} className="py-3">
                {request.kind === 'sent' ? (
                  request.state === 'needs_reconfirmation' ? (
                    <>
                      Your request for the ride to {ride} on {when} needs your confirmation before
                      the owner can decide.
                    </>
                  ) : (
                    <>
                      Your request for the ride to {ride} on {when} is waiting for the ride owner.
                    </>
                  )
                ) : request.state === 'needs_reconfirmation' ? (
                  <>
                    {request.riderName}&apos;s request for your ride to {ride} on {when} needs their
                    confirmation before you can decide.
                  </>
                ) : (
                  <>
                    {request.riderName} asked to join your ride to {ride} on {when}.
                  </>
                )}
              </li>
            );
          })}

          {pendingRequests
            .filter(
              (request) => !requests.some((waiting) => waiting.requestId === request.requestId),
            )
            .map((request) => (
              <li key={request.requestId} className="py-3">
                <JoinRequestDetails request={request} />
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function JoinRequestDetails({ request }: { request: RiderJoinRequest }) {
  return (
    <div className="space-y-2">
      <p>
        Request for{' '}
        <Link href={routes.ride(request.rideId)} className="font-semibold underline">
          {request.destination}
        </Link>
      </p>

      <p>
        Departure:{' '}
        <span className="font-mono tabular-nums">{formatDeparture(request.departure)}</span>
      </p>

      <p>
        Status: <strong>{statusLabel(request.status)}</strong>
      </p>

      <p>Pickup point: {request.pickupPoint}</p>

      <p>Estimated fare share: ₹{request.estimatedShare}</p>

      {request.reasonCode && <p>Reason: {reasonLabel(request.reasonCode)}</p>}

      <RequestStatusHistory request={request} />
    </div>
  );
}

function JoinRequestHistory({ requests }: { requests: RiderJoinRequest[] }) {
  return (
    <section aria-labelledby="join-request-history-heading" className="mt-10">
      <h2 id="join-request-history-heading" className="text-xl font-bold tracking-tight">
        Join request history
      </h2>

      {requests.length === 0 ? (
        <p className="mt-2 text-ink-muted">You have not submitted any join requests.</p>
      ) : (
        <ul
          aria-label="Join request history"
          className="mt-3 divide-y divide-line border-y border-line"
        >
          {requests.map((request) => (
            <li key={request.requestId} className="py-3">
              <JoinRequestDetails request={request} />
              <p className="mt-2 text-sm text-ink-muted">
                Submitted: {formatDeparture(request.submittedAt)}
              </p>
              <p className="text-sm text-ink-muted">
                Last updated: {formatDeparture(request.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestStatusHistory({ request }: { request: RiderJoinRequest }) {
  if (request.history.length === 0) {
    return <p className="text-sm text-ink-muted">No status history yet.</p>;
  }

  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-medium">
        View status history ({request.history.length})
      </summary>

      <ol className="mt-2 space-y-2 border-l border-line pl-4">
        {request.history.map((event) => (
          <li key={event.id}>
            <p>{statusLabel(event.newStatus)}</p>

            {event.reasonCode && (
              <p className="text-sm text-ink-muted">Reason: {reasonLabel(event.reasonCode)}</p>
            )}

            <p className="text-sm text-ink-muted">{formatDeparture(event.changedAt)}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'needs_reconfirmation':
      return 'Needs reconfirmation';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'withdrawn':
      return 'Withdrawn';
    case 'expired':
      return 'Expired';
    case 'ride_cancelled':
      return 'Ride cancelled';
    case 'left':
      return 'Left ride';
    case 'no_show':
      return 'No-show';
    case 'completed':
      return 'Completed';
  }
}

function reasonLabel(reasonCode: string): string {
  const labels: Record<string, string> = {
    ride_full: 'ride full',
    ride_cancelled: 'ride cancelled',
    owner_rejected: 'ride owner rejected the request',
    rider_withdrew: 'rider withdrew the request',
    departure_changed: 'departure changed',
    pickup_changed: 'pickup point changed',
    fare_changed: 'estimated fare changed',
  };

  return labels[reasonCode] ?? reasonCode.replaceAll('_', ' ');
}
