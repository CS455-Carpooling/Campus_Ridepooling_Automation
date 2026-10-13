'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { Place } from '@/lib/ride-options';
import type { RideView } from '@/lib/ride-view';

function toLocalInput(value: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(value))
    .replace(' ', 'T');
}

function fromLocalInput(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function RideManagementControls({ ride, hubs }: { ride: RideView; hubs: Place[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (ride.viewerRole !== 'owner' || ride.state !== 'scheduled') return null;

  async function save(form: HTMLFormElement, confirmAffectedRiders: boolean) {
    const data = new FormData(form);
    const departureStart = fromLocalInput(data.get('departureStart'));
    const departureEnd = fromLocalInput(data.get('departureEnd'));
    if (!departureStart || !departureEnd) {
      setError('Enter a valid departure window in India Standard Time.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(ride.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          departureStart,
          departureEnd,
          capacity: Number(data.get('capacity')),
          expectedTotalFare: Number(data.get('expectedTotalFare')),
          direction: data.get('direction'),
          hubId: data.get('hubId'),
          confirmAffectedRiders,
        }),
      });
      const result = (await response.json()) as { error?: string; code?: string };
      if (response.status === 409 && result.code === 'confirmation_required') {
        setConfirmEdit(true);
        setError(result.error ?? 'This change affects confirmed riders.');
        return;
      }
      if (!response.ok) {
        setError(result.error ?? 'Unable to save ride changes.');
        return;
      }
      setConfirmEdit(false);
      setMessage('Ride changes saved. Affected riders have been notified.');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(ride.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'Unable to cancel this ride.');
        return;
      }
      setConfirmCancel(false);
      setMessage('The ride was cancelled. Riders have been notified and owe no fare.');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="manage-ride-heading"
      className="mt-8 rounded-panel border border-line p-5"
    >
      <h2 id="manage-ride-heading" className="text-xl font-bold tracking-tight">
        Manage this ride
      </h2>
      {ride.isLocked ? (
        <p className="mt-2 text-ink-muted">
          This ride is locked. It can no longer be edited, but you may still cancel it before pickup
          starts.
        </p>
      ) : (
        <form
          className="mt-3 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmEdit(false);
            void save(event.currentTarget, false);
          }}
        >
          <label className="grid gap-1 text-sm font-semibold">
            Direction
            <select
              name="direction"
              defaultValue={ride.direction}
              className="min-h-11 rounded-control border border-line-strong bg-surface px-3"
            >
              <option value="to_hub">Leaving campus</option>
              <option value="from_hub">Coming to campus</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Destination
            <select
              name="hubId"
              defaultValue={ride.hubId}
              className="min-h-11 rounded-control border border-line-strong bg-surface px-3"
            >
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Departure window starts (IST)
            <input
              name="departureStart"
              type="datetime-local"
              required
              defaultValue={toLocalInput(ride.departureStart)}
              className="min-h-11 rounded-control border border-line-strong bg-surface px-3"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Departure window ends (IST)
            <input
              name="departureEnd"
              type="datetime-local"
              required
              defaultValue={toLocalInput(ride.departureEnd)}
              className="min-h-11 rounded-control border border-line-strong bg-surface px-3"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Vehicle capacity (owner included)
            <input
              name="capacity"
              type="number"
              min={ride.occupantCount}
              max={20}
              required
              defaultValue={ride.capacity}
              className="min-h-11 rounded-control border border-line-strong bg-surface px-3"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Expected total fare (₹)
            <input
              name="expectedTotalFare"
              type="number"
              min={1}
              max={50000}
              required
              defaultValue={ride.totalFare}
              className="min-h-11 rounded-control border border-line-strong bg-surface px-3"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
            {confirmEdit && (
              <Button
                type="button"
                variant="secondary"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form) void save(form, true);
                }}
                disabled={busy}
              >
                Confirm and notify riders
              </Button>
            )}
          </div>
        </form>
      )}
      {confirmCancel ? (
        <div className="mt-5 rounded-panel border border-danger p-4">
          <p className="font-semibold">Cancel this ride?</p>
          <p className="mt-1 text-sm text-ink-muted">
            Every pending or accepted request will be cancelled, any locked fare liability will be
            released, and riders will be notified.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void cancel()} disabled={busy}>
              {busy ? 'Cancelling…' : 'Yes, cancel ride'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)} disabled={busy}>
              Keep ride
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-5" variant="secondary" onClick={() => setConfirmCancel(true)}>
          Cancel ride
        </Button>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="mt-3 text-sm text-ink-muted">
        Changes that affect confirmed riders require your confirmation. Editing is available only
        before lock; cancellation is available until pickup starts.
      </p>
    </section>
  );
}
