import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { IncidentActions } from '@/components/admin/incidents/IncidentActions';
import { IncidentStatusLabel } from '@/components/admin/incidents/IncidentStatusLabel';
import { RideStateLabel } from '@/components/rides/RideStateLabel';
import { requireAdminPage } from '@/lib/admin-auth';
import { getIncident } from '@/lib/admin-incident-queries';
import { formatDeparture, formatDepartureWindow } from '@/lib/format';
import { routes } from '@/lib/routes';
import { seatStatusLabels } from '@/lib/trip-rules';

export const metadata: Metadata = { title: 'SOS incident' };

/**
 * /admin/incidents/[id] (CS455-65: FR-RD-15.2, 15.5, FR-RO-13.2): one SOS alert with the trip as
 * it was when it was raised, the raiser's mobile number and location (admins only, SYS-NFR-07),
 * and the actions to acknowledge and close it.
 */
export default async function AdminIncidentPage({ params }: PageProps<'/admin/incidents/[id]'>) {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const { id } = await params;
  const incident = await getIncident(id);
  if (!incident) notFound();
  const { ride, occupants } = incident.context;

  return (
    <AdminPageShell
      title={incident.reference}
      eyebrow="SOS incident"
      back={{ href: routes.adminIncidents, label: 'Back to SOS incidents' }}
      actions={<IncidentStatusLabel status={incident.status} />}
      description={`Raised by ${incident.raiserName} (${incident.raisedRole}) on ${incident.rideTitle}, ${formatDeparture(incident.raisedAt)}.`}
    >
      {incident.falseAlarmAt && (
        <p className="mb-6 font-semibold">
          {incident.raiserName} marked it a false alarm at {formatDeparture(incident.falseAlarmAt)}.
        </p>
      )}

      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Fact term="Mobile number">
          {incident.mobileNumber ? (
            <a href={`tel:${incident.mobileNumber}`} className="font-mono tabular-nums">
              {incident.mobileNumber}
            </a>
          ) : (
            'Not given'
          )}
        </Fact>
        <Fact term="Location">
          {incident.location ? (
            <>
              <a
                href={`https://www.openstreetmap.org/?mlat=${incident.location.latitude}&mlon=${incident.location.longitude}#map=17/${incident.location.latitude}/${incident.location.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono tabular-nums"
              >
                {incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}
              </a>
              <p className="text-sm font-normal text-ink-muted">
                {incident.location.accuracyM !== null &&
                  `Within about ${Math.round(incident.location.accuracyM)} m, `}
                shared {formatDeparture(incident.location.at)}
              </p>
            </>
          ) : (
            'Not shared'
          )}
        </Fact>
        <Fact term="Trip when raised">
          <RideStateLabel state={incident.tripState} />
        </Fact>
        <Fact term="Departure">
          {formatDepartureWindow(ride.departureStart, ride.departureEnd)}
        </Fact>
        <Fact term="Vehicle">{ride.vehicle}</Fact>
        <Fact term="Ride">
          <Link href={routes.adminRide(incident.rideId)}>{ride.title}</Link>
        </Fact>
      </dl>

      <section aria-labelledby="occupants-heading" className="mt-10">
        <h2 id="occupants-heading" className="text-xl font-bold tracking-tight">
          On the ride when it was raised
        </h2>
        <ul
          aria-label="On the ride when it was raised"
          className="mt-3 divide-y divide-line border-y border-line"
        >
          {occupants.map((person) => (
            <li key={person.userId} className="py-3">
              <Link href={routes.adminRider(person.userId)} className="font-semibold">
                {person.name}
              </Link>
              {person.raisedTheAlert && (
                <span className="font-semibold text-danger"> raised the alert</span>
              )}
              <p className="text-sm text-ink-muted">
                {person.role === 'owner' ? 'Owner' : 'Rider'}, {person.place}
                {person.role === 'rider' && `, ${seatStatusLabels[person.status].toLowerCase()}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {(incident.acknowledged || incident.closed) && (
        <section aria-labelledby="handling-heading" className="mt-10">
          <h2 id="handling-heading" className="text-xl font-bold tracking-tight">
            Handling
          </h2>
          <ul className="mt-3 space-y-2">
            {incident.acknowledged && (
              <li>
                Acknowledged by {incident.acknowledged.by},{' '}
                {formatDeparture(incident.acknowledged.at)}
              </li>
            )}
            {incident.closed && (
              <li>
                Closed by {incident.closed.by}, {formatDeparture(incident.closed.at)}:{' '}
                <span className="text-ink-muted">{incident.closed.note}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      <IncidentActions incidentId={incident.id} status={incident.status} />
    </AdminPageShell>
  );
}

// No Tailwind `block` class on the wrapper: src/index.css has its own `.block` that wins.
function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}
