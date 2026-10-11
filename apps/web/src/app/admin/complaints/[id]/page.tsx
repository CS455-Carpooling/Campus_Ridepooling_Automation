import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { ComplaintStatusActions } from '@/components/admin/complaints/ComplaintStatusActions';
import { AiComplaintReview } from '@/components/admin/complaints/AiComplaintReview';
import { ComplaintStatusLabel } from '@/components/complaints/ComplaintStatusLabel';
import { RideStateLabel } from '@/components/rides/RideStateLabel';
import { requireAdminPage } from '@/lib/admin-auth';
import { getComplaintDetail, type ComplaintPersonLink } from '@/lib/admin-complaint-queries';
import { complaintCategoryLabels } from '@/lib/complaint-rules';
import { formatDeparture, formatDepartureWindow } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Complaint' };

function Person({ role, person }: { role: string; person: ComplaintPersonLink }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{role}</dt>
      <dd className="mt-1 flex flex-col">
        <Link href={routes.adminRider(person.id)} className="font-semibold">
          {person.name}
        </Link>
        <span className="text-sm text-ink-muted">{person.email}</span>
      </dd>
    </div>
  );
}

/**
 * /admin/complaints/[id] (CS455-53, OA-FR-18, 20; SYS-FR-31, 47): one complaint, with the
 * complainant's own words unchanged, the reported messages, the people and the ride, the
 * accused's other complaints, and moving it to Under review or Resolved.
 */
export default async function AdminComplaintPage({ params }: PageProps<'/admin/complaints/[id]'>) {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const { id } = await params;
  const complaint = await getComplaintDetail(id);
  if (!complaint) notFound();

  const resolved = complaint.status === 'resolved';
  return (
    <AdminPageShell
      title={`Complaint ${complaint.reference}`}
      eyebrow={complaintCategoryLabels[complaint.category]}
      back={{ href: routes.adminComplaints, label: 'Back to complaints' }}
      actions={<ComplaintStatusLabel status={complaint.status} />}
      description={`${complaint.source === 'chat_report' ? 'From a reported chat message' : 'From the complaint form'}, filed ${formatDeparture(complaint.createdAt)}.${complaint.legacyReference ? ` Chat report ${complaint.legacyReference}.` : ''}`}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="words-heading">
            <h2 id="words-heading" className="text-xl font-bold tracking-tight">
              What they reported
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Exactly as filed. It can never be edited, by anyone.
            </p>
            <p className="mt-3 whitespace-pre-line rounded-panel border border-line-strong p-5 text-lg">
              {complaint.description}
            </p>
          </section>

          {complaint.messages.length > 0 && (
            <section aria-labelledby="messages-heading">
              <h2 id="messages-heading" className="text-xl font-bold tracking-tight">
                Reported chat messages
              </h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {complaint.messages.map((message) => (
                  <li key={message.id} className="py-3">
                    <p className="text-sm text-ink-muted">
                      {message.senderName}, {formatDeparture(message.sentAt)}
                    </p>
                    <p className="mt-1">{message.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="status-heading">
            <h2 id="status-heading" className="text-xl font-bold tracking-tight">
              Status
            </h2>
            {resolved ? (
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-ink-muted">Outcome</dt>
                  <dd className="mt-1 font-semibold">
                    {complaint.actionTaken ? 'Action was taken' : 'No action was taken'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Resolved</dt>
                  <dd className="mt-1">
                    {complaint.resolvedAt ? formatDeparture(complaint.resolvedAt) : 'Unknown'}
                    {complaint.resolvedBy ? `, by ${complaint.resolvedBy}` : ''}
                  </dd>
                </div>
                {complaint.note && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-ink-muted">Note</dt>
                    <dd className="mt-1 whitespace-pre-line">{complaint.note}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="mt-3">
                <ComplaintStatusActions
                  complaintId={complaint.id}
                  status={complaint.status}
                  version={complaint.version}
                />
              </div>
            )}
          </section>

          <AiComplaintReview complaintId={complaint.id} history={complaint.aiHistory} />
        </div>

        <aside className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="people-heading">
            <h2 id="people-heading" className="text-xl font-bold tracking-tight">
              People
            </h2>
            <dl className="mt-3 flex flex-col gap-4">
              <Person role="Complained" person={complaint.complainant} />
              <Person role="About" person={complaint.accused} />
            </dl>
          </section>

          <section aria-labelledby="ride-heading">
            <h2 id="ride-heading" className="text-xl font-bold tracking-tight">
              Ride
            </h2>
            <p className="mt-3">
              <Link href={routes.adminRide(complaint.ride.id)} className="font-semibold">
                {complaint.ride.title}
              </Link>
            </p>
            <p className="mt-1 font-mono text-sm tabular-nums">
              {formatDepartureWindow(complaint.ride.departureStart, complaint.ride.departureEnd)}
            </p>
            <RideStateLabel state={complaint.ride.state} className="mt-2" />
          </section>

          <section aria-labelledby="earlier-heading">
            <h2 id="earlier-heading" className="text-xl font-bold tracking-tight">
              Other complaints about {complaint.accused.name}
            </h2>
            {complaint.earlierAboutAccused.length === 0 ? (
              <p className="mt-3 text-ink-muted">None.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {complaint.earlierAboutAccused.map((earlier) => (
                  <li
                    key={earlier.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <span>
                      <Link
                        href={routes.adminComplaint(earlier.id)}
                        className="font-mono font-semibold"
                      >
                        {earlier.reference}
                      </Link>{' '}
                      <span className="text-sm text-ink-muted">
                        {complaintCategoryLabels[earlier.category]},{' '}
                        {formatDeparture(earlier.createdAt)}
                      </span>
                    </span>
                    <ComplaintStatusLabel status={earlier.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </AdminPageShell>
  );
}
