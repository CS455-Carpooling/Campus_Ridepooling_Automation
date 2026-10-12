'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { OpenIncidentSummary } from '@/lib/admin-incident-queries';
import { routes } from '@/lib/routes';

/** How often admin pages ask for new SOS alerts (P-22: visible to admins within 5 seconds). */
export const INCIDENT_POLL_MS = 3000;

/**
 * The SOS alert bar on every admin page (CS455-65, FR-RD-15.2). It asks for unacknowledged
 * alerts every 3 seconds while the tab is visible and stays until an admin acknowledges them.
 * A failed request leaves the bar as it was and tries again on the next tick.
 */
export function IncidentAlert() {
  const [summary, setSummary] = useState<OpenIncidentSummary | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/admin/incidents/open', { cache: 'no-store' });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as OpenIncidentSummary;
        if (!stopped) setSummary(data);
      } catch {
        // Offline or the server is busy: the next tick tries again.
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), INCIDENT_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  if (!summary || summary.unacknowledged === 0 || !summary.newest) return null;
  const { newest, unacknowledged } = summary;
  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-panel border-2 border-danger bg-danger px-5 py-3 text-on-primary"
    >
      <p className="font-semibold">
        {unacknowledged === 1 ? 'New SOS alert' : `${unacknowledged} SOS alerts not acknowledged`}:{' '}
        <span className="font-mono">{newest.reference}</span> on {newest.rideTitle}
      </p>
      <div className="flex flex-wrap gap-x-4">
        <Link
          href={routes.adminIncident(newest.id)}
          className="font-semibold text-on-primary underline underline-offset-4"
        >
          Open it
        </Link>
        {unacknowledged > 1 && (
          <Link
            href={routes.adminIncidents}
            className="font-semibold text-on-primary underline underline-offset-4"
          >
            See all
          </Link>
        )}
      </div>
    </div>
  );
}
