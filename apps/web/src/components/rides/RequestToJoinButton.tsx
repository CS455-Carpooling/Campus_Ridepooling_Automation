'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  rideId: string;
  pickupPointId: string;
  disabled?: boolean;
};

type ApiError = {
  error?: string;
  code?: string;
};

export function RequestToJoinButton({ rideId, pickupPointId, disabled = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function requestToJoin() {
    if (loading || submitted || disabled) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`/api/rides/${rideId}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupPointId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errorBody = body as ApiError | null;
        throw new Error(
          errorBody?.error ?? 'Could not submit your join request. Please try again.',
        );
      }

      setSubmitted(true);
      setMessage('Join request submitted. Waiting for the ride owner.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'A network error occurred. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={requestToJoin}
        disabled={disabled || loading || submitted || !pickupPointId}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-accent px-5 font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Submitting request…' : submitted ? 'Request submitted' : 'Request to Join'}
      </button>

      {message && (
        <p
          className="mt-2 text-sm text-ink-muted"
          role={submitted ? 'status' : 'alert'}
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  );
}
