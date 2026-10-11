import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { ComplaintStatusLabel } from '@/components/complaints/ComplaintStatusLabel';
import { RideStateLabel } from '@/components/rides/RideStateLabel';
import { requireAdminPage } from '@/lib/admin-auth';
import { getAdminRide } from '@/lib/admin-rider-queries';
import { complaintCategoryLabels } from '@/lib/complaint-rules';
import { formatDeparture, formatDepartureWindow, formatRupees } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Ride' };

/**
 * /admin/rides/[id] (CS455-53, OA-FR-16, SYS-FR-17): a ride as an admin sees it, with everyone
 * on it and its complaints. Read only: no admin page or API changes a ride.
 */
export default async function AdminRidePage({ params }: PageProps<'/admin/rides/[id]'>) {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const { id } = await params;
  const ride = await getAdminRide(id);
  if (!ride) notFound();

  const facts: Array<[string, string]> = [
    ['Departure', formatDepartureWindow(ride.departureStart, ride.departureEnd)],
    ['Vehicle', `${ride.vehicleName}, ${ride.capacity} people`],
    ['Total fare', formatRupees(ride.totalFare)],
    ['Offered', formatDeparture(ride.createdAt)],
    ['Completed', ride.completedAt ? formatDeparture(ride.completedAt) : 'Not yet'],
  ];

  return (
    <AdminPageShell
      title={ride.title}
      eyebrow="Ride"
      back={{ href: routes.adminComplaints, label: 'Back to complaints' }}
      actions={<RideStateLabel state={ride.state} />}
      description="Read only. Admins can see a ride but never change it."
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="mt-0.5 font-mono tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="people-heading">
          <h2 id="people-heading" className="text-xl font-bold tracking-tight">
            People on this ride
          </h2>
          <ul
            aria-label="People on this ride"
            className="mt-3 divide-y divide-line border-y border-line"
          >
            {ride.occupants.map((person) => (
              <li key={person.userId} className="py-3">
                <Link href={routes.adminRider(person.userId)} className="font-semibold">
                  {person.name}
                </Link>
                <p className="text-sm text-ink-muted">
                  {person.isOwner ? 'Owner' : 'Rider'}, {person.campusPlace}, joined{' '}
                  {formatDeparture(person.joinedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ride-complaints-heading">
          <h2 id="ride-complaints-heading" className="text-xl font-bold tracking-tight">
            Complaints about this ride
          </h2>
          {ride.complaints.length === 0 ? (
            <p className="mt-3 text-ink-muted">None.</p>
          ) : (
            <ul
              aria-label="Complaints about this ride"
              className="mt-3 divide-y divide-line border-y border-line"
            >
              {ride.complaints.map((complaint) => (
                <li
                  key={complaint.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    <Link
                      href={routes.adminComplaint(complaint.id)}
                      className="font-mono font-semibold"
                    >
                      {complaint.reference}
                    </Link>{' '}
                    <span className="text-sm text-ink-muted">
                      {complaintCategoryLabels[complaint.category]}
                    </span>
                  </span>
                  <ComplaintStatusLabel status={complaint.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}
