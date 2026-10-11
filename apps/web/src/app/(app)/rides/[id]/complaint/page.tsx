import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ComplaintForm } from '@/components/complaints/ComplaintForm';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { getCurrentUser } from '@/lib/auth';
import { getComplaintFormPage, type ComplaintFormPage } from '@/lib/complaint-queries';
import { formatDeparture, formatDepartureWindow } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Report a problem' };

/** Why the form is not offered, for a trip complaint outside its window (FR-RD-13.1). */
function windowNotice(page: ComplaintFormPage): string {
  switch (page.window) {
    case 'not_completed':
      return 'You can report a problem with the trip once the owner marks the ride completed, and for 7 days after. To report a chat message now, use Report on the message in the ride chat.';
    case 'cancelled':
      return 'This ride was cancelled, so there is no trip to report a problem with.';
    default:
      return `Complaints about this trip closed on ${formatDeparture(page.closesAt ?? '')}, 7 days after it was completed.`;
  }
}

/**
 * /rides/[id]/complaint (CS455-53, FR-RD-13.1, 09.6): someone on a ride reports a problem
 * with another person on it. `?message=` names a chat message being reported. Only the people
 * on the ride may open it; anyone else gets "Ride not found".
 */
export default async function RideComplaintPage({
  params,
  searchParams,
}: PageProps<'/rides/[id]/complaint'>) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const { id } = await params;
  const query = await searchParams;
  const messageId = typeof query.message === 'string' ? query.message : null;
  const page = await getComplaintFormPage(id, user.id, messageId);
  if (!page) notFound();

  const canFile = page.window === 'open' || page.message !== null;
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={routes.ride(page.rideId)}
        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-accent-text"
      >
        Back to the ride
      </Link>
      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
          Report a problem
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{page.title}</h1>
        <p className="mt-4 font-mono text-lg tabular-nums">
          {formatDepartureWindow(page.departureStart, page.departureEnd)}
        </p>
      </header>
      {canFile ? (
        <ComplaintForm page={page} />
      ) : (
        <p className="mt-8 rounded-panel border border-line-strong p-5 text-ink-muted sm:p-6">
          {windowNotice(page)}
        </p>
      )}
    </DesignSystem>
  );
}
