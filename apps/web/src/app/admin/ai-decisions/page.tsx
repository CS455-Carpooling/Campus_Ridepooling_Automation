import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNotAllowed } from '../../../components/admin/AdminNotAllowed';
import { AdminPageShell } from '../../../components/admin/AdminPageShell';
import { requireAdminPage } from '../../../lib/admin-auth';
import { listAiDecisionHistory } from '../../../lib/admin-complaint-queries';
import { listChatbotAudits } from '../../../lib/ai/chatbot-audit';
import { formatDeparture } from '../../../lib/format';
import { routes } from '../../../lib/routes';

export const metadata: Metadata = { title: 'AI enforcement & agent decisions' };

const actionLabel = (action: 'none' | 'warning' | 'suspension') =>
  action === 'none' ? 'No enforcement action' : action[0].toUpperCase() + action.slice(1);

/** The protected and retained AI recommendation / human decision history (SYS-FR-38) and agent interaction traces (AI-RD-12). */
export default async function AdminAiDecisionsPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;
  const [decisions, chatbotAudits] = await Promise.all([
    listAiDecisionHistory(),
    listChatbotAudits().catch(() => []),
  ]);

  return (
    <AdminPageShell
      title="AI decision history"
      back={{ href: routes.adminComplaints, label: 'Back to complaints' }}
      description="Each entry shows the advisory recommendation and the final action chosen by an operations admin, alongside AI agent interaction audit traces (AI-RD-12)."
    >
      <section aria-labelledby="enforcement-heading" className="mb-12">
        <h2 id="enforcement-heading" className="text-xl font-bold mb-4">
          Advisory enforcement decisions (SYS-FR-38)
        </h2>
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
      </section>

      <section aria-labelledby="chatbot-audits-heading" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div>
            <h2 id="chatbot-audits-heading" className="text-xl font-bold">
              Chatbot interaction audit logs (AI-RD-12)
            </h2>
            <p className="text-sm text-ink-muted">
              Immutable traces retained for 90 days (P-28). Exposes tool arguments, result sizes, validation outcomes, and pseudonymous rider IDs without private message content.
            </p>
          </div>
        </div>

        {chatbotAudits.length === 0 ? (
          <p className="text-ink-muted">No chatbot audit records recorded yet.</p>
        ) : (
          <div className="overflow-x-auto border border-line rounded-lg">
            <table className="w-full text-left text-sm" aria-label="Chatbot audit records">
              <thead className="bg-canvas-subtle border-b border-line text-xs font-semibold uppercase text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Time</th>
                  <th scope="col" className="px-4 py-3">Rider ID</th>
                  <th scope="col" className="px-4 py-3">Model / Version</th>
                  <th scope="col" className="px-4 py-3">Tool Calls & Arguments</th>
                  <th scope="col" className="px-4 py-3">Validation Outcome</th>
                  <th scope="col" className="px-4 py-3">Fallback</th>
                  <th scope="col" className="px-4 py-3">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {chatbotAudits.map((audit) => (
                  <tr key={audit.requestId} className="hover:bg-canvas-subtle/50">
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                      {formatDeparture(audit.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold">
                      {audit.pseudonymousRiderId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <div>{audit.modelVersion}</div>
                      <div className="text-[11px] text-ink-muted">v{audit.promptVersion}</div>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs">
                      {audit.toolCalls.length === 0 ? (
                        <span className="text-ink-muted">None</span>
                      ) : (
                        <ul className="space-y-1">
                          {audit.toolCalls.map((tc, idx) => (
                            <li key={idx}>
                              <span className="font-semibold text-accent-text">{tc.tool}</span>
                              {tc.resultSize !== undefined && (
                                <span className="text-ink-muted ml-1">({tc.resultSize} results)</span>
                              )}
                              {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                                <div className="text-[11px] font-mono text-ink-muted truncate max-w-xs">
                                  {JSON.stringify(tc.arguments)}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-canvas-muted text-ink">
                        {audit.validationOutcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {audit.fallbackUsed ? (
                        <span className="text-amber-600 font-semibold">Fallback used</span>
                      ) : (
                        <span className="text-ink-muted">Direct</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-muted">
                      {audit.latencyMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}
