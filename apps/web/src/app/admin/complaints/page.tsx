import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { ComplaintQueueFilters } from '@/components/admin/complaints/ComplaintQueueFilters';
import { ComplaintStatusLabel } from '@/components/complaints/ComplaintStatusLabel';
import { requireAdminPage } from '@/lib/admin-auth';
import { listComplaints, parseQueueFilters } from '@/lib/admin-complaint-queries';
import { complaintCategoryLabels } from '@/lib/complaint-rules';
import { cx } from '@/lib/cx';
import { formatDeparture } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Complaints' };

/**
 * /admin/complaints (CS455-53, OA-FR-16, 18; SYS-FR-19): one queue for every complaint, from
 * the complaint form and from reported chat messages, Safety first, then the longest waiting.
 * It replaces the chat report list (CS455-45), whose reports are complaints now.
 */
export default async function AdminComplaintsPage({
  searchParams,
}: PageProps<'/admin/complaints'>) {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const filters = parseQueueFilters(await searchParams);
  const complaints = await listComplaints(filters);

  return (
    <AdminPageShell
      title="Complaints"
      description="Safety complaints come first, then the ones waiting longest. Open a complaint to review it."
    >
      <ComplaintQueueFilters filters={filters} />
      {complaints.length === 0 ? (
        <p className="mt-8 text-ink-muted">No complaints match these filters.</p>
      ) : (
        <ul aria-label="Complaints" className="mt-8 divide-y divide-line border-y border-line">
          {complaints.map((complaint) => {
            const safety = complaint.category === 'safety';
            return (
              <li
                key={complaint.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={routes.adminComplaint(complaint.id)}
                      className="font-mono font-semibold tabular-nums"
                    >
                      {complaint.reference}
                    </Link>
                    <span className={cx('font-semibold', safety && 'text-danger')}>
                      {complaintCategoryLabels[complaint.category]}
                    </span>
                    {complaint.source === 'chat_report' && (
                      <span className="text-sm text-ink-muted">Chat report</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    About {complaint.about}, on {complaint.rideTitle}. Filed{' '}
                    {formatDeparture(complaint.createdAt)}.
                  </p>
                </div>
                <ComplaintStatusLabel status={complaint.status} />
              </li>
            );
          })}
        </ul>
      )}
    </AdminPageShell>
  );
}
