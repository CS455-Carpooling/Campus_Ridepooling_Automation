import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ComplaintStatusLabel } from '@/components/complaints/ComplaintStatusLabel';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { getCurrentUser } from '@/lib/auth';
import { getMyComplaints } from '@/lib/complaint-queries';
import { complaintCategoryLabels } from '@/lib/complaint-rules';
import { formatDeparture } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Your complaints' };

/**
 * /complaints (CS455-53, FR-RD-13.5): the complaints the signed-in person filed, with their
 * status and, once resolved, whether action was taken, never which sanction.
 */
export default async function MyComplaintsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const complaints = await getMyComplaints(user.id);
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={routes.home}
        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-accent-text"
      >
        Back to your rides
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Your complaints</h1>
      <p className="mt-3 text-ink-muted">
        An operations admin reviews each complaint. You see its status here; the person it is about
        is never told who complained.
      </p>
      {complaints.length === 0 ? (
        <div className="mt-8">
          <p className="text-ink-muted">
            You have not filed a complaint. To report a problem, open the ride and choose Report a
            problem.
          </p>
          <ButtonLink href={routes.home} variant="secondary" className="mt-4">
            Go to your rides
          </ButtonLink>
        </div>
      ) : (
        <ul aria-label="Your complaints" className="mt-8 divide-y divide-line border-y border-line">
          {complaints.map((complaint) => (
            <li
              key={complaint.reference}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4"
            >
              <div className="min-w-0">
                <p className="font-mono font-semibold tabular-nums">{complaint.reference}</p>
                <p className="mt-1">
                  {complaintCategoryLabels[complaint.category]}, about {complaint.about}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  <Link href={routes.ride(complaint.rideId)}>{complaint.rideTitle}</Link>,{' '}
                  {formatDeparture(complaint.departureStart)}. Filed{' '}
                  {formatDeparture(complaint.filedAt)}.
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <ComplaintStatusLabel status={complaint.status} />
                {complaint.actionTaken !== null && (
                  <p className="text-sm text-ink-muted">
                    {complaint.actionTaken ? 'Action was taken' : 'No action was taken'}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DesignSystem>
  );
}
