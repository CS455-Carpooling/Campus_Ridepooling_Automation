'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { formatRupees } from '@/lib/format';
import type { RideView } from '@/lib/ride-view';

export function SettlementPanel({ ride }: { ride: RideView }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  if (ride.state !== 'completed' || ride.viewerRole === 'visitor') return null;

  async function submit(occupantId: string, body: Record<string, string>) {
    setError('');
    setBusy(occupantId);
    try {
      const response = await fetch(
        `/api/rides/${encodeURIComponent(ride.id)}/settlements/${encodeURIComponent(occupantId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? 'Could not update the payment.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not update the payment. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="settlement-heading"
      className="mt-8 rounded-panel border border-line p-5"
    >
      <h2 id="settlement-heading" className="text-xl font-bold">
        Settle ride shares
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Payment happens outside the app. Mark a transfer only after paying the owner directly.
      </p>
      {ride.viewerRole === 'rider' && (
        <RiderSettlement
          ride={ride}
          submit={submit}
          busy={busy === ride.viewerSettlement?.occupantId}
        />
      )}
      {ride.viewerRole === 'owner' && <OwnerSettlements ride={ride} submit={submit} busy={busy} />}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function RiderSettlement({
  ride,
  submit,
  busy,
}: {
  ride: RideView;
  submit: (occupantId: string, body: Record<string, string>) => Promise<void>;
  busy: boolean;
}) {
  const rider = ride.viewerSettlement;
  if (!rider) {
    return ride.trip?.viewerNoShow ? (
      <p className="mt-4 text-sm text-ink-muted">
        No share is due because you were marked as a no-show.
      </p>
    ) : null;
  }
  const settlement = rider;
  if (settlement.status !== 'due') {
    return (
      <p className="mt-4">
        Your share is <strong>{settlement.status}</strong>
        {settlement.method ? ` · ${settlement.method.toUpperCase()}` : ''}
        {settlement.reference ? ` · Reference ${settlement.reference}` : ''}
      </p>
    );
  }
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
      aria-label="Mark your share paid"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void submit(rider.occupantId, {
          action: 'paid',
          method: String(data.get('method')),
          reference: String(data.get('reference') ?? ''),
        });
      }}
    >
      <label className="grid gap-1 text-sm font-semibold">
        Payment method
        <select
          name="method"
          defaultValue="upi"
          className="rounded-control border border-line bg-surface px-3 py-2"
        >
          <option value="upi">UPI</option>
          <option value="cash">Cash</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Reference (optional)
        <input
          name="reference"
          maxLength={50}
          className="rounded-control border border-line bg-surface px-3 py-2"
        />
      </label>
      <div className="self-end">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Mark paid'}
        </Button>
      </div>
      <p className="text-sm text-ink-muted sm:col-span-3">
        Due: {formatRupees(rider.share ?? 0)}. The owner must confirm receipt.
      </p>
    </form>
  );
}

function OwnerSettlements({
  ride,
  submit,
  busy,
}: {
  ride: RideView;
  submit: (occupantId: string, body: Record<string, string>) => Promise<void>;
  busy: string | null;
}) {
  const riders = ride.ownerSettlements ?? [];
  if (!riders.length)
    return <p className="mt-4 text-sm text-ink-muted">No rider payments are due.</p>;
  return (
    <ul className="mt-4 divide-y divide-line">
      {riders.map((rider) => (
        <li
          key={rider.occupantId}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div>
            <p className="font-semibold">
              {rider.name}: {formatRupees(rider.share ?? 0)}
            </p>
            <p className="text-sm text-ink-muted">
              {rider.status}
              {rider.method ? ` · ${rider.method.toUpperCase()}` : ''}
              {rider.reference ? ` · Reference ${rider.reference}` : ''}
            </p>
          </div>
          {rider.status === 'paid' && (
            <div className="flex gap-2">
              <Button
                disabled={busy === rider.occupantId}
                onClick={() => void submit(rider.occupantId, { action: 'confirm' })}
              >
                Confirm receipt
              </Button>
              <Button
                variant="quiet"
                disabled={busy === rider.occupantId}
                onClick={() => void submit(rider.occupantId, { action: 'dispute' })}
              >
                Dispute
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
