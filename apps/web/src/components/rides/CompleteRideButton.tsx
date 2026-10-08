'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The owner's "Mark ride completed" action (CS455-41, FR-RO-09.4 in part). It
 * asks first, in place, because a completed ride cannot be reopened; then it
 * calls POST /api/rides/[id]/complete and reads the page again, which shows the
 * ride as completed and moves it to the owner's history.
 */
export function CompleteRideButton({ rideId }: { rideId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');
  const openButton = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);
  const headingId = useId();
  const busy = sending || refreshing;

  // Focus follows the switch between the button and the question, but not on the first render.
  useEffect(() => {
    if (!moveFocus.current) return;
    (confirming ? question.current : openButton.current)?.focus();
  }, [confirming]);

  function show(next: boolean) {
    moveFocus.current = true;
    setError('');
    setConfirming(next);
  }

  async function complete() {
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/complete`, {
        method: 'POST',
      });
      if (response.status === 401) {
        router.push(routes.login);
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Unable to mark the ride completed right now.');
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (!confirming) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button ref={openButton} variant="secondary" onClick={() => show(true)}>
          Mark ride completed
        </Button>
        <p className="text-sm text-ink-muted">
          Once the ride is over, mark it completed so everyone on it can rate each other.
        </p>
      </div>
    );
  }

  return (
    <section
      ref={question}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="mt-6 rounded-panel border border-line-strong p-5 sm:p-6"
    >
      <h2 id={headingId} className="text-lg font-bold tracking-tight">
        Mark this ride completed?
      </h2>
      <p className="mt-2 text-ink-muted">
        Everyone on it can then rate each other for 72 hours, and the ride moves to your history. A
        completed ride cannot be reopened.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={complete} disabled={busy}>
          {busy ? 'Marking completed…' : 'Yes, mark it completed'}
        </Button>
        <Button variant="secondary" onClick={() => show(false)} disabled={busy}>
          Not yet
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
