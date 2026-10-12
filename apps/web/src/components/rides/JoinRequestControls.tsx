'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { formatDeparture, formatRupees } from '@/lib/format';
import type { Place } from '@/lib/ride-options';
import type { ViewerRole } from '@/lib/ride-status';

type Snapshot = {
  departureStart: string;
  pickupAt: string;
  estimatedShare: number;
};

type RiderRequest = {
  id: string;
  status: string;
  reasonCode: string | null;
  submittedAt: string;
  acceptedAt: string | null;
  agreed: Snapshot;
  current: Snapshot;
  lateCancellation: boolean;
  lockedShare: number | null;
  history: Array<{
    from: string | null;
    to: string;
    reasonCode: string | null;
    details: Record<string, unknown>;
    at: string;
  }>;
};

type OwnerRequest = {
  id: string;
  status: string;
  reasonCode: string | null;
  submittedAt: string;
  riderName: string;
  pickupName: string;
  visibleTags: string[];
  agreed: Snapshot;
  current: Snapshot;
};

type RequestPayload = { role: 'rider' | 'owner'; requests: RiderRequest[] | OwnerRequest[] };

const statusText: Record<string, string> = {
  pending: 'Waiting for the ride owner',
  needs_reconfirmation: 'Your confirmation is needed',
  accepted: 'Accepted',
  rejected: 'Not accepted',
  withdrawn: 'Withdrawn',
  expired: 'Expired at lock time',
  ride_cancelled: 'Ride cancelled',
  left: 'You left this ride',
  completed: 'Ride completed',
  no_show: 'Marked no-show',
};

function date(value: string) {
  return formatDeparture(value);
}

function Status({ value }: { value: string }) {
  return <span className="font-semibold">{statusText[value] ?? value.replaceAll('_', ' ')}</span>;
}

export function JoinRequestControls({
  rideId,
  role,
  isOpen,
  hasSeats,
  pickupPlaces,
  defaultPickupLocationId,
  isScheduled,
}: {
  rideId: string;
  role: ViewerRole;
  isOpen: boolean;
  hasSeats: boolean;
  pickupPlaces: Place[];
  defaultPickupLocationId: string | null;
  isScheduled: boolean;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<RequestPayload | null>(null);
  const [pickupLocationId, setPickupLocationId] = useState(
    defaultPickupLocationId && pickupPlaces.some((place) => place.id === defaultPickupLocationId)
      ? defaultPickupLocationId
      : (pickupPlaces[0]?.id ?? ''),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const idempotencyKey = useRef<string | null>(null);
  const endpoint = `/api/rides/${encodeURIComponent(rideId)}/requests`;

  const reload = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load request status.');
      setPayload((await response.json()) as RequestPayload);
    } catch {
      setError('Unable to load request status. Refresh the page to try again.');
    }
  }, [endpoint]);

  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);

  async function submit() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupLocationId, idempotencyKey: idempotencyKey.current }),
      });
      const result = (await response.json()) as {
        error?: string;
        request?: { idempotent: boolean };
      };
      if (!response.ok) {
        setError(result.error ?? 'Unable to submit your request.');
        return;
      }
      setMessage(
        result.request?.idempotent
          ? 'This request was already submitted.'
          : 'Your request was sent to the ride owner.',
      );
      idempotencyKey.current = null;
      await reload();
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function act(requestId: string, action: string, confirmLate = false) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, confirmLate }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (response.status === 409 && action === 'leave' && !confirmLate) {
          if (
            window.confirm(
              'This ride is locked. Leaving now keeps your locked fare share payable. Leave anyway?',
            )
          ) {
            await act(requestId, action, true);
          }
          return;
        }
        setError(result.error ?? 'Unable to update your request.');
        return;
      }
      setMessage('Your request has been updated.');
      await reload();
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (role === 'owner') {
    const requests = payload?.role === 'owner' ? (payload.requests as OwnerRequest[]) : [];
    return (
      <section
        aria-labelledby="join-requests-heading"
        className="mt-8 rounded-panel border border-line p-5"
      >
        <h2 id="join-requests-heading" className="text-xl font-bold tracking-tight">
          Join requests
        </h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-ink-muted">There are no requests waiting for your decision.</p>
        ) : (
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {requests.map((request) => (
              <li key={request.id} className="py-4">
                <p className="font-semibold">{request.riderName}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {request.status === 'needs_reconfirmation'
                    ? 'Rider must reconfirm before acceptance.'
                    : 'Waiting since '}
                  {request.status === 'pending' && date(request.submittedAt)}
                </p>
                <p className="mt-1 text-sm">
                  Pickup: {request.pickupName} · Estimated share:{' '}
                  {formatRupees(request.current.estimatedShare)}
                </p>
                {request.status === 'needs_reconfirmation' && (
                  <p className="mt-1 text-sm text-danger">
                    Updated from {date(request.agreed.departureStart)} /{' '}
                    {formatRupees(request.agreed.estimatedShare)} to{' '}
                    {date(request.current.departureStart)} /{' '}
                    {formatRupees(request.current.estimatedShare)}.
                  </p>
                )}
                {request.visibleTags.length > 0 && (
                  <p className="mt-1 text-sm text-ink-muted">
                    Visible interests: {request.visibleTags.join(', ')}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => void act(request.id, 'accept')}
                    disabled={busy || request.status !== 'pending' || !hasSeats || !isOpen}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void act(request.id, 'reject')}
                    disabled={busy}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {isOpen && (
          <Button className="mt-4" variant="secondary" onClick={() => void lock()} disabled={busy}>
            Lock ride now
          </Button>
        )}
        {isScheduled && (
          <p className="mt-2 text-sm text-ink-muted">
            It locks automatically one hour before departure.
          </p>
        )}
        <p role="status" className="mt-2 text-sm text-ink-muted">
          {message}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
    );
  }

  const requests = payload?.role === 'rider' ? (payload.requests as RiderRequest[]) : [];
  const current = requests.find((request) =>
    ['pending', 'needs_reconfirmation', 'accepted'].includes(request.status),
  );
  const mayRequest = role === 'visitor' && isOpen && hasSeats && !current;

  return (
    <section
      aria-labelledby="your-request-heading"
      className="mt-8 rounded-panel border border-line p-5"
    >
      <h2 id="your-request-heading" className="text-xl font-bold tracking-tight">
        Your request
      </h2>
      {mayRequest && (
        <div className="mt-3">
          <label htmlFor="request-pickup" className="block text-sm font-semibold">
            {role === 'visitor' ? 'Choose your pickup point' : 'Pickup point'}
          </label>
          <select
            id="request-pickup"
            value={pickupLocationId}
            onChange={(event) => setPickupLocationId(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 sm:max-w-sm"
            disabled={busy || pickupPlaces.length === 0}
          >
            {pickupPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
          <Button
            className="mt-3"
            onClick={() => void submit()}
            disabled={busy || !pickupLocationId}
          >
            {busy ? 'Sending…' : 'Request a seat'}
          </Button>
          {!isOpen && (
            <p className="mt-2 text-sm text-ink-muted">This ride is no longer open for requests.</p>
          )}
          {isOpen && !hasSeats && <p className="mt-2 text-sm text-ink-muted">This ride is full.</p>}
        </div>
      )}
      {current && (
        <div className="mt-3">
          <p>
            <Status value={current.status} />
          </p>
          {current.status === 'needs_reconfirmation' && (
            <>
              <p className="mt-2 text-sm">
                Departure: {date(current.agreed.departureStart)} →{' '}
                {date(current.current.departureStart)}
              </p>
              <p className="text-sm">
                Pickup estimate: {date(current.agreed.pickupAt)} → {date(current.current.pickupAt)}
              </p>
              <p className="text-sm">
                Estimated share: {formatRupees(current.agreed.estimatedShare)} →{' '}
                {formatRupees(current.current.estimatedShare)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void act(current.id, 'reconfirm')} disabled={busy}>
                  Confirm new terms
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void act(current.id, 'decline')}
                  disabled={busy}
                >
                  Decline
                </Button>
              </div>
            </>
          )}
          {current.status === 'pending' && (
            <>
              <p className="mt-1 text-sm text-ink-muted">
                Requested {date(current.submittedAt)} · estimated share{' '}
                {formatRupees(current.current.estimatedShare)}.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => void act(current.id, 'withdraw')}
                disabled={busy}
              >
                Withdraw request
              </Button>
            </>
          )}
          {current.status === 'accepted' && isScheduled && (
            <>
              <p className="mt-1 text-sm text-ink-muted">
                Accepted ·{' '}
                {current.lockedShare === null
                  ? `current share ${formatRupees(current.current.estimatedShare)}`
                  : `locked share ${formatRupees(current.lockedShare)}`}
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => void act(current.id, 'leave')}
                disabled={busy}
              >
                Leave ride
              </Button>
            </>
          )}
        </div>
      )}
      {requests
        .filter((request) => request !== current)
        .map((request) => (
          <details key={request.id} className="mt-4 border-t border-line pt-3">
            <summary className="cursor-pointer">
              Request history: <Status value={request.status} />
            </summary>
            <p className="mt-2 text-sm text-ink-muted">Submitted {date(request.submittedAt)}</p>
            {request.reasonCode && (
              <p className="text-sm text-ink-muted">
                Reason: {request.reasonCode.replaceAll('_', ' ')}
              </p>
            )}
            {request.lateCancellation && request.lockedShare !== null && (
              <p className="text-sm">
                Fare liability retained: {formatRupees(request.lockedShare)}
              </p>
            )}
            <ol className="mt-2 list-inside list-disc text-sm text-ink-muted">
              {request.history.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  {date(event.at)}: {event.from ? `${statusText[event.from] ?? event.from} → ` : ''}
                  {statusText[event.to] ?? event.to}
                  {event.reasonCode ? ` (${event.reasonCode.replaceAll('_', ' ')})` : ''}
                </li>
              ))}
            </ol>
          </details>
        ))}
      <p role="status" className="mt-2 text-sm text-ink-muted">
        {message}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );

  async function lock() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/lock`, {
        method: 'POST',
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'Unable to lock this ride.');
        return;
      }
      setMessage('The ride is locked. Membership and fare shares are fixed.');
      await reload();
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
}
