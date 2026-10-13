import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { IncidentStatusLabel } from '@/components/admin/incidents/IncidentStatusLabel';
import { requireAdminPage } from '@/lib/admin-auth';
import { listIncidents } from '@/lib/admin-incident-queries';
import { formatDeparture } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'SOS incidents' };

/**
 * /admin/incidents (CS455-65: FR-RD-15.2, FR-RO-13.2): every SOS alert, open ones first, then
 * acknowledged, then closed, newest first within each. False alarms stay listed, marked.
 */
export default async function AdminIncidentsPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;
  const incidents = await listIncidents();

  return (
    <AdminPageShell
      title="SOS incidents"
      description="Alerts raised during trips. Open ones come first: acknowledge an alert as soon as someone is on it, and close it once it is handled."
    >
      {incidents.length === 0 ? (
        <p className="text-ink-muted">No SOS alerts have been raised.</p>
      ) : (
        <ul aria-label="SOS incidents" className="divide-y divide-line border-y border-line">
          {incidents.map((incident) => (
            <li
              key={incident.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    href={routes.adminIncident(incident.id)}
                    className="font-mono font-semibold tabular-nums"
                  >
                    {incident.reference}
                  </Link>
                  <span className="font-semibold">{incident.rideTitle}</span>
                  {incident.falseAlarm && (
                    <span className="text-sm text-ink-muted">Marked a false alarm</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  Raised by {incident.raiserName} (
                  {incident.raisedRole === 'owner' ? 'owner' : 'rider'}),{' '}
                  {formatDeparture(incident.raisedAt)}.{' '}
                  {incident.locationShared ? 'Location shared.' : 'No location.'}
                </p>
              </div>
              <IncidentStatusLabel status={incident.status} />
            </li>
          ))}
        </ul>
      )}
    </AdminPageShell>
  );
}
