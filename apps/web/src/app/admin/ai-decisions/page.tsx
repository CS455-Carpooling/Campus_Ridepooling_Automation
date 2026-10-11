import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { requireAdminPage } from '@/lib/admin-auth';
import { listAiDecisionHistory } from '@/lib/admin-complaint-queries';
import { formatDeparture } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'AI enforcement decisions' };

const actionLabel = (action: 'none' | 'warning' | 'suspension') =>
  action === 'none' ? 'No enforcement action' : action[0].toUpperCase() + action.slice(1);

/** The protected and retained AI recommendation / human decision history (SYS-FR-38). */
export default async function AdminAiDecisionsPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;
  const decisions = await listAiDecisionHistory();

  return (
    <AdminPageShell
      title="AI decision history"
      back={{ href: routes.adminComplaints, label: 'Back to complaints' }}
      description="Each entry shows the advisory recommendation and the final action explicitly chosen by an operations admin."
    >
      {decisions.length === 0 ? (
        <p className="text-ink-muted">No AI enforcement decisions have been recorded.</p>
      ) : (
        <ol
          aria-label="AI enforcement decisions"
          className="divide-y divide-line border-y border-line"
        >
          {decisions.map((entry) => (
            <li key={entry.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    <Link href={routes.adminComplaint(entry.complaintId)}>
                      {entry.complaintReference}
                    </Link>{' '}
                    · <Link href={routes.adminRider(entry.accusedId)}>{entry.accusedName}</Link>
                  </p>
                  <p className="mt-1 text-sm">
                    Recommendation: {actionLabel(entry.recommendedAction)}
                    {entry.recommendedAction === 'suspension' &&
                      (entry.recommendedIndefinite
                        ? ' (indefinite)'
                        : ` (${entry.recommendedSuspensionDays} days)`)}
                    {' · '}Decision: {entry.decision}
                    {' · '}Final action: {actionLabel(entry.finalAction)}
                  </p>
                </div>
                <time dateTime={entry.decidedAt} className="text-sm text-ink-muted">
                  {formatDeparture(entry.decidedAt)}
                </time>
              </div>
              {entry.analysisSummary && (
                <p className="mt-3 whitespace-pre-line text-sm">
                  <span className="font-semibold">AI summary: </span>
                  {entry.analysisSummary}
                </p>
              )}
              {entry.reason && (
                <p className="mt-2 whitespace-pre-line text-sm">
                  <span className="font-semibold">Admin reason: </span>
                  {entry.reason}
                </p>
              )}
              <p className="mt-2 text-sm text-ink-muted">Decided by {entry.decidedBy}</p>
            </li>
          ))}
        </ol>
      )}
    </AdminPageShell>
  );
}
