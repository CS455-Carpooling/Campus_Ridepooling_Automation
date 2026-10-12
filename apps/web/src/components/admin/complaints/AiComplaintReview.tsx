'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { sendAdminChange } from '@/components/admin/config/admin-request';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import type { ComplaintAiHistoryEntry } from '@/lib/admin-complaint-queries';
import {
  parseAiDecisionRequest,
  type AiDecisionAction,
  type AiDecisionName,
} from '@/lib/complaint-ai-rules';
import { routes } from '@/lib/routes';

const actionLabels: Record<AiDecisionAction, string> = {
  none: 'No enforcement action',
  warning: 'Warning',
  suspension: 'Suspension',
};

const fallbackLabels: Record<
  Exclude<ComplaintAiHistoryEntry['outcome'], 'ai_validated'>,
  string
> = {
  fallback_model_error: 'The AI model could not complete the analysis.',
  fallback_timeout: 'The AI analysis timed out.',
  fallback_invalid: 'The AI returned output that failed validation.',
  fallback_low_confidence: 'The AI output was below the confidence threshold.',
  fallback_service_error: 'The AI service is unavailable.',
};

function DecisionForm({
  complaintId,
  analysis,
}: {
  complaintId: string;
  analysis: ComplaintAiHistoryEntry;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [decision, setDecision] = useState<AiDecisionName>('approved');
  const [finalAction, setFinalAction] = useState<AiDecisionAction>(
    analysis.recommendedAction ?? 'none',
  );
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(
    analysis.recommendedSuspensionDays === null ? '' : String(analysis.recommendedSuspensionDays),
  );
  const [indefinite, setIndefinite] = useState(analysis.recommendedIndefinite);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseAiDecisionRequest({
      decision,
      finalAction,
      reason: reason.trim() || null,
      ...(finalAction === 'suspension'
        ? indefinite
          ? { indefinite: true }
          : { days: days === '' ? undefined : Number(days) }
        : {}),
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setMessage('');
    setSending(true);
    const result = await sendAdminChange<{ decision: unknown }>(
      'POST',
      `/api/admin/complaints/${complaintId}/ai-decision`,
      { analysisId: analysis.id, ...parsed.value },
    );
    setSending(false);
    if (result.ok) {
      startTransition(() => router.refresh());
      return;
    }
    if (result.status === 401) {
      router.push(routes.login);
      return;
    }
    setErrors(result.fields);
    setMessage(result.error);
    if (result.code === 'already_decided') startTransition(() => router.refresh());
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={`Decide on AI recommendation ${analysis.id}`}
      className="mt-5 rounded-control border border-line p-4"
    >
      <h4 className="font-semibold">Record your decision</h4>
      <p className="mt-1 text-sm text-ink-muted">
        Approval must match the recommendation. Use Override to choose a different action. No AI
        result changes the rider account unless you submit an authorized decision.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Decision"
          value={decision}
          onChange={(event) => {
            const next = event.target.value as AiDecisionName;
            setDecision(next);
            if (next === 'rejected') setFinalAction('none');
            else if (next === 'approved') setFinalAction(analysis.recommendedAction ?? 'none');
          }}
          error={errors.decision}
        >
          <option value="approved">Approve recommendation</option>
          <option value="rejected">Reject recommendation</option>
          <option value="overridden">Override recommendation</option>
        </SelectField>
        <SelectField
          label="Final action"
          value={finalAction}
          onChange={(event) => setFinalAction(event.target.value as AiDecisionAction)}
          error={errors.finalAction}
        >
          {Object.entries(actionLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      {finalAction === 'suspension' && (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={indefinite}
              onChange={(event) => setIndefinite(event.target.checked)}
            />
            <span className="font-semibold">Indefinite suspension</span>
          </label>
          {!indefinite && (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Suspension length in days
              <input
                type="number"
                min={1}
                max={3650}
                step={1}
                required
                value={days}
                onChange={(event) => setDays(event.target.value)}
                aria-invalid={errors.length ? true : undefined}
                className="min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base font-normal"
              />
            </label>
          )}
          {errors.length && <p className="text-sm text-danger">{errors.length}</p>}
        </div>
      )}
      {finalAction !== 'none' || decision !== 'approved' ? (
        <div className="mt-4">
          <TextAreaField
            label={
              decision === 'rejected'
                ? 'Reason for rejection'
                : decision === 'overridden'
                  ? 'Reason for override'
                  : 'Reason for enforcement action'
            }
            hint="Required for rejection, override, warning, or suspension. Kept in the audit history."
            value={reason}
            maxLength={1000}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
          />
          {errors.reason && <p className="mt-1 text-sm text-danger">{errors.reason}</p>}
        </div>
      ) : null}
      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}
      <Button type="submit" disabled={sending || refreshing} className="mt-4">
        {sending || refreshing ? 'Saving decision…' : 'Save decision'}
      </Button>
    </form>
  );
}

export function AiComplaintReview({
  complaintId,
  history,
  resolved,
}: {
  complaintId: string;
  history: ComplaintAiHistoryEntry[];
  resolved: boolean;
}) {
  return (
    <section aria-labelledby="ai-review-heading">
      <h2 id="ai-review-heading" className="text-xl font-bold tracking-tight">
        AI complaint review
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Advisory analysis only. The original report above remains the source record; only an
        operations admin can apply enforcement.
      </p>
      {history.length === 0 ? (
        <p className="mt-3 rounded-panel border border-line p-4">
          Manual review required. No validated AI analysis is available; review the original
          complaint and continue without AI.
        </p>
      ) : (
        <ol aria-label="AI analysis and decision history" className="mt-4 space-y-4">
          {history.map((analysis) => (
            <li key={analysis.id} className="rounded-panel border border-line p-4 sm:p-5">
              {analysis.outcome !== 'ai_validated' ? (
                <div>
                  <p className="font-semibold">Manual review required</p>
                  <p className="mt-1 text-sm text-ink-muted">{fallbackLabels[analysis.outcome]}</p>
                </div>
              ) : (
                <>
                  <p className="font-semibold">
                    Advisory severity: {analysis.severity}
                    {analysis.confidence !== null &&
                      ` · Confidence ${Math.round(analysis.confidence * 100)}%`}
                  </p>
                  <p className="mt-3 whitespace-pre-line">{analysis.summary}</p>
                  <p className="mt-3 text-sm">
                    <span className="font-semibold">Behavioral tags:</span>{' '}
                    {analysis.behaviorTags.length > 0
                      ? analysis.behaviorTags.map((tag) => tag.replaceAll('_', ' ')).join(', ')
                      : 'None'}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">Recommended action:</span>{' '}
                    {analysis.recommendedAction
                      ? actionLabels[analysis.recommendedAction]
                      : 'Unavailable'}
                    {analysis.recommendedAction === 'suspension' &&
                      (analysis.recommendedIndefinite
                        ? ' (indefinite)'
                        : ` (${analysis.recommendedSuspensionDays} days)`)}
                  </p>
                </>
              )}

              <p className="mt-3 text-xs text-ink-muted">
                Analysis recorded <time dateTime={analysis.createdAt}>{analysis.createdAt}</time>.
              </p>

              {analysis.decision ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="font-semibold">
                    Admin decision: {analysis.decision.decision}; final action{' '}
                    {actionLabels[analysis.decision.finalAction]}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {analysis.decision.decidedBy},{' '}
                    <time dateTime={analysis.decision.decidedAt}>
                      {analysis.decision.decidedAt}
                    </time>
                  </p>
                  {analysis.decision.reason && (
                    <p className="mt-2 whitespace-pre-line">{analysis.decision.reason}</p>
                  )}
                </div>
              ) : analysis.outcome === 'ai_validated' && !resolved ? (
                <DecisionForm complaintId={complaintId} analysis={analysis} />
              ) : analysis.outcome === 'ai_validated' ? (
                <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
                  This complaint is resolved; no further AI decision can be recorded.
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
