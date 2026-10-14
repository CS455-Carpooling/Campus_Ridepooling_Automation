import type { Metadata } from 'next';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { requireAdminPage } from '@/lib/admin-auth';
import { listRecommendationAudits } from '@/lib/admin-recommendation-audits';
import { formatDeparture } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'AI recommendation oversight' };

const validationLabel = (outcome: 'passed' | 'failed' | 'not_run') =>
  outcome === 'passed' ? 'Passed' : outcome === 'failed' ? 'Failed' : 'Not run';

export default async function AdminAiRecommendationsPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;
  const audits = await listRecommendationAudits();

  return (
    <AdminPageShell
      title="AI recommendation oversight"
      back={{ href: routes.admin, label: 'Back to admin home' }}
      description="Recommendation requests and rider reports retained for 90 days. Rider identifiers are pseudonymous; contact details and profiles are not shown."
    >
      {audits.length === 0 ? (
        <p className="text-ink-muted">No recommendation audits have been recorded.</p>
      ) : (
        <ol
          aria-label="AI recommendation audit records"
          className="divide-y divide-line border-y border-line"
        >
          {audits.map((audit) => (
            <li key={audit.requestId} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Request {audit.requestId}</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Rider pseudonym: {audit.riderPseudonym.slice(0, 12)}…
                  </p>
                </div>
                <time dateTime={audit.createdAt} className="text-sm text-ink-muted">
                  {formatDeparture(audit.createdAt)}
                </time>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="inline font-semibold">Model / prompt: </dt>
                  <dd className="inline">
                    {audit.modelVersion} / {audit.promptVersion}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Outcome: </dt>
                  <dd className="inline">{audit.outcome}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Output validation: </dt>
                  <dd className="inline">{validationLabel(audit.validationOutcome)}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Fallback: </dt>
                  <dd className="inline">{audit.fallbackUsed ? 'Used' : 'Not used'}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Tool calls: </dt>
                  <dd className="inline">{audit.toolCallCount} (none are configured)</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Latency: </dt>
                  <dd className="inline">{audit.latencyMs} ms</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Input / output tokens: </dt>
                  <dd className="inline">
                    {audit.inputTokens ?? 'Not reported'} / {audit.outputTokens ?? 'Not reported'}
                  </dd>
                </div>
              </dl>
              <section
                className="mt-4 border-t border-line pt-3"
                aria-label="Recommendation reports"
              >
                <h3 className="text-sm font-semibold">Rider reports</h3>
                {audit.reports.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-muted">No reports for this request.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {audit.reports.map((report) => (
                      <li key={report.id}>
                        {report.reason === 'wrong'
                          ? 'Wrong recommendation'
                          : 'Inappropriate recommendation'}
                        {' · '}Ride {report.rideId}
                        {' · '}
                        <time dateTime={report.createdAt}>{formatDeparture(report.createdAt)}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </li>
          ))}
        </ol>
      )}
    </AdminPageShell>
  );
}
