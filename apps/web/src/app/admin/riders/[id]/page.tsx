import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { RiderEnforcementActions } from '@/components/admin/riders/RiderEnforcementActions';
import { ComplaintStatusLabel } from '@/components/complaints/ComplaintStatusLabel';
import { RideStateLabel } from '@/components/rides/RideStateLabel';
import { requireAdminPage } from '@/lib/admin-auth';
import type { EarlierComplaint } from '@/lib/admin-complaint-queries';
import { getRiderRecord } from '@/lib/admin-rider-queries';
import { complaintCategoryLabels } from '@/lib/complaint-rules';
import { formatDeparture } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Rider record' };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const None = ({ text }: { text: string }) => <p className="text-ink-muted">{text}</p>;

function ComplaintList({ complaints, label }: { complaints: EarlierComplaint[]; label: string }) {
  if (complaints.length === 0) return <None text="None." />;
  return (
    <ul aria-label={label} className="divide-y divide-line border-y border-line">
      {complaints.map((complaint) => (
        <li key={complaint.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span>
            <Link href={routes.adminComplaint(complaint.id)} className="font-mono font-semibold">
              {complaint.reference}
            </Link>{' '}
            <span className="text-sm text-ink-muted">
              {complaintCategoryLabels[complaint.category]}, {formatDeparture(complaint.createdAt)}
            </span>
          </span>
          <ComplaintStatusLabel status={complaint.status} />
        </li>
      ))}
    </ul>
  );
}

/**
 * /admin/riders/[id] (CS455-53, OA-FR-42, SYS-NFR-07): a rider's record for admins: identity,
 * account status, rides, complaints filed and received, warnings and suspensions. It only
 * shows: admins cannot change a rider's profile (SYS-FR-44), and history is never deleted.
 */
export default async function AdminRiderPage({ params }: PageProps<'/admin/riders/[id]'>) {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const { id } = await params;
  const rider = await getRiderRecord(id);
  if (!rider) notFound();

  const status = rider.suspension
    ? `Suspended ${rider.suspension.endsAt ? `until ${formatDeparture(rider.suspension.endsAt)}` : 'until an admin lifts it'} (${complaintCategoryLabels[rider.suspension.reasonCategory]})`
    : 'Active';
  const identity: Array<[string, string]> = [
    ['Full name', rider.fullName],
    ['Display name', rider.displayName ?? 'Not set'],
    ['Email', rider.email],
    ['Roll number', rider.rollNumber],
    ['Mobile', rider.mobile ?? 'Not given'],
    ['Account', rider.isAdmin ? 'Operations admin' : 'Student'],
    ['Email verified', rider.verified ? 'Yes' : 'No'],
    ['Joined', formatDeparture(rider.joinedAt)],
  ];

  return (
    <AdminPageShell
      title={rider.displayName ?? rider.fullName}
      eyebrow="Rider record"
      back={{ href: routes.adminRiders, label: 'Back to riders' }}
      description="Only operations admins can see this record. Nothing here changes the rider's profile."
    >
      <p
        className={
          rider.suspension
            ? 'rounded-panel border border-danger p-4 font-semibold text-danger'
            : 'rounded-panel border border-line p-4 font-semibold'
        }
      >
        Account status: {status}
      </p>

      <div className="mt-8">
        <RiderEnforcementActions
          riderId={rider.id}
          isAdmin={rider.isAdmin}
          suspended={Boolean(rider.suspension)}
          complaints={rider.complaintsReceived}
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <Section id="identity-heading" title="Identity">
          <dl className="grid gap-3 sm:grid-cols-2">
            {identity.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-ink-muted">{label}</dt>
                <dd className="mt-0.5 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="rides-heading" title="Rides">
          {rider.rides.length === 0 ? (
            <None text="No rides yet." />
          ) : (
            <ul aria-label="Rides" className="divide-y divide-line border-y border-line">
              {rider.rides.map((ride) => (
                <li
                  key={ride.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    <Link href={routes.adminRide(ride.id)} className="font-semibold">
                      {ride.title}
                    </Link>
                    <span className="text-sm text-ink-muted">
                      {' '}
                      {ride.asOwner ? 'Owner' : 'Rider'}, {formatDeparture(ride.departureStart)}
                    </span>
                    {ride.noShow && (
                      <span className="text-sm font-semibold text-danger"> No-show</span>
                    )}
                  </span>
                  <RideStateLabel state={ride.state} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="received-heading" title="Complaints about them">
          <ComplaintList complaints={rider.complaintsReceived} label="Complaints about them" />
        </Section>

        <Section id="filed-heading" title="Complaints they filed">
          <ComplaintList complaints={rider.complaintsFiled} label="Complaints they filed" />
        </Section>

        <Section id="warnings-heading" title="Warnings">
          {rider.warnings.length === 0 ? (
            <None text="No warnings." />
          ) : (
            <ul aria-label="Warnings" className="divide-y divide-line border-y border-line">
              {rider.warnings.map((warning) => (
                <li key={warning.id} className="py-3">
                  <p>{warning.reason}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatDeparture(warning.issuedAt)}, by {warning.issuedBy}
                    {warning.complaintReference ? `, for ${warning.complaintReference}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {warning.acknowledgedAt
                      ? `Acknowledged ${formatDeparture(warning.acknowledgedAt)}`
                      : 'Not acknowledged'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="suspensions-heading" title="Suspensions">
          {rider.suspensions.length === 0 ? (
            <None text="No suspensions." />
          ) : (
            <ul aria-label="Suspensions" className="divide-y divide-line border-y border-line">
              {rider.suspensions.map((suspension) => (
                <li key={suspension.id} className="py-3">
                  <p className="font-semibold">
                    {complaintCategoryLabels[suspension.reasonCategory]}:{' '}
                    {formatDeparture(suspension.startsAt)} to{' '}
                    {suspension.endsAt ? formatDeparture(suspension.endsAt) : 'indefinite'}
                  </p>
                  <p className="mt-1">{suspension.reason}</p>
                  <p className="mt-1 text-sm text-ink-muted">By {suspension.issuedBy}</p>
                  {suspension.liftedAt && (
                    <p className="mt-1 text-sm text-ink-muted">
                      Lifted {formatDeparture(suspension.liftedAt)} by {suspension.liftedBy}:{' '}
                      {suspension.liftReason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </AdminPageShell>
  );
}
