'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { routes } from '@/lib/routes';

/** How often an open ride page asks whether the trip changed (P-13: changes show within 2 s). */
export const TRIP_POLL_MS = 2000;

/**
 * While `active`, asks GET /api/rides/[id]/trip for the trip's stamp every `intervalMs` and reads
 * the page again when it changes, so everyone on the ride sees pickup start, arrivals, no-shows
 * and completion without reloading (CS455-63). It skips a tick while the tab is hidden, and a
 * failed request simply waits for the next tick.
 */
export function useTripRefresh(rideId: string, active: boolean, intervalMs = TRIP_POLL_MS) {
  const router = useRouter();
  const stamp = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;

    async function poll() {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/trip`, {
          cache: 'no-store',
        });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as { stamp?: unknown };
        if (typeof data.stamp !== 'string' || stopped) return;
        if (stamp.current !== null && stamp.current !== data.stamp) router.refresh();
        stamp.current = data.stamp;
      } catch {
        // Offline or the server is busy: the next tick tries again.
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [rideId, active, intervalMs, router]);
}

/** Mounts useTripRefresh from a server-rendered page; it renders nothing. */
export function TripRefresh({ rideId, active }: { rideId: string; active: boolean }) {
  useTripRefresh(rideId, active);
  return null;
}

/** The current time, read again every `intervalMs`, so time-based buttons switch on by themselves. */
export function useNow(intervalMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * POSTs to a trip API (CS455-63) and reads the page again once the server confirms, or keeps the
 * reason it gave. A signed-out user goes to the sign-in page.
 */
export function useTripRequest(failure = 'Unable to update the trip right now.') {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');

  async function send(url: string, body?: object) {
    setSending(true);
    setError('');
    try {
      const response = await fetch(
        url,
        body
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          : { method: 'POST' },
      );
      if (response.status === 401) {
        router.push(routes.login);
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? failure);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return { send, busy: sending || refreshing, error, clearError: () => setError('') };
}
