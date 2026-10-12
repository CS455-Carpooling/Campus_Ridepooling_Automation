'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { sendAdminChange } from '@/components/admin/config/admin-request';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { complaintCategoryLabels, type ComplaintCategory } from '@/lib/complaint-rules';
import {
  ENFORCEMENT_RULES,
  parseReactivationRequest,
  parseSuspensionRequest,
  parseWarningRequest,
} from '@/lib/enforcement-rules';
import { routes } from '@/lib/routes';

type ComplaintOption = { id: string; reference: string; category: ComplaintCategory };

export function RiderEnforcementActions({
  riderId,
  isAdmin,
  suspended,
  complaints,
}: {
  riderId: string;
  isAdmin: boolean;
  suspended: boolean;
  complaints: ComplaintOption[];
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [warningReason, setWarningReason] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [category, setCategory] = useState<ComplaintCategory | ''>('');
  const [complaintId, setComplaintId] = useState('');
  const [days, setDays] = useState('');
  const [indefinite, setIndefinite] = useState(false);
  const [reactivationReason, setReactivationReason] = useState('');
  const [warningErrors, setWarningErrors] = useState<Record<string, string>>({});
  const [suspensionErrors, setSuspensionErrors] = useState<Record<string, string>>({});
  const [reactivationErrors, setReactivationErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<
    'warning' | 'suspension' | 'reactivation' | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function send(
    url: string,
    body: unknown,
    setActionErrors: (fields: Record<string, string>) => void,
    successText: string,
  ): Promise<boolean> {
    setActionErrors({});
    setMessage('');
    setSuccessMessage('');
    setBusy(true);
    const result = await sendAdminChange<{
      warning?: unknown;
      suspension?: unknown;
      reactivation?: unknown;
    }>('POST', url, body);
    setBusy(false);
    if (result.ok) {
      setSuccessMessage(successText);
      startTransition(() => router.refresh());
      return true;
    }
    if (result.status === 401) {
      router.push(routes.login);
      return false;
    }
    setActionErrors(result.fields);
    setMessage(result.error);
    return false;
  }

  async function warn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseWarningRequest({ reason: warningReason, complaintId: complaintId || null });
    if (!parsed.ok) {
      setWarningErrors(parsed.errors);
      return;
    }
    if (pendingAction !== 'warning') {
      setPendingAction('warning');
      setMessage('');
      setSuccessMessage('');
      return;
    }
    setPendingAction(null);
    if (
      await send(
        `/api/admin/riders/${riderId}/warnings`,
        parsed.value,
        setWarningErrors,
        'Warning issued.',
      )
    ) {
      setWarningReason('');
    }
  }

  async function suspend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseSuspensionRequest({
      reasonCategory: category,
      reason: suspensionReason,
      ...(indefinite ? { indefinite: true } : { days: days === '' ? undefined : Number(days) }),
      complaintId: complaintId || null,
    });
    if (!parsed.ok) {
      setSuspensionErrors(parsed.errors);
      return;
    }
    if (pendingAction !== 'suspension') {
      setPendingAction('suspension');
      setMessage('');
      setSuccessMessage('');
      return;
    }
    setPendingAction(null);
    if (
      await send(
        `/api/admin/riders/${riderId}/suspensions`,
        parsed.value,
        setSuspensionErrors,
        'Suspension saved.',
      )
    ) {
      setSuspensionReason('');
      setIndefinite(false);
    }
  }

  async function reactivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseReactivationRequest({ reason: reactivationReason });
    if (!parsed.ok) {
      setReactivationErrors(parsed.errors);
      return;
    }
    if (pendingAction !== 'reactivation') {
      setPendingAction('reactivation');
      setMessage('');
      setSuccessMessage('');
      return;
    }
    setPendingAction(null);
    if (
      await send(
        `/api/admin/riders/${riderId}/reactivation`,
        parsed.value,
        setReactivationErrors,
        'Rider reactivated.',
      )
    ) {
      setReactivationReason('');
    }
  }

  const disabled = busy || refreshing;
  if (isAdmin) {
    return (
      <section aria-labelledby="enforcement-heading">
        <h2 id="enforcement-heading" className="text-xl font-bold tracking-tight">
          Account enforcement
        </h2>
        <p className="mt-3 text-ink-muted">Operations admins cannot be disciplined as riders.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="enforcement-heading">
      <h2 id="enforcement-heading" className="text-xl font-bold tracking-tight">
        Account enforcement
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        These actions are performed by you, not by AI, and are recorded with your admin identity.
      </p>
      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}
      {successMessage && (
        <p role="status" className="mt-3 text-sm font-semibold text-ink">
          {successMessage}
        </p>
      )}
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <form
          noValidate
          onSubmit={warn}
          aria-label="Issue rider warning"
          className="flex flex-col gap-4 rounded-panel border border-line p-4 sm:p-5"
        >
          <h3 className="text-lg font-bold">Issue a warning</h3>
          <TextAreaField
            label="Reason"
            value={warningReason}
            maxLength={ENFORCEMENT_RULES.reasonMax}
            rows={3}
            onChange={(event) => {
              setWarningReason(event.target.value);
              setPendingAction(null);
            }}
          />
          {warningErrors.reason && <p className="text-sm text-danger">{warningErrors.reason}</p>}
          <SelectField
            label="Related complaint (optional)"
            value={complaintId}
            onChange={(event) => {
              setComplaintId(event.target.value);
              setPendingAction(null);
            }}
            error={warningErrors.complaintId}
          >
            <option value="">No linked complaint</option>
            {complaints.map((complaint) => (
              <option value={complaint.id} key={complaint.id}>
                {complaint.reference} · {complaintCategoryLabels[complaint.category]}
              </option>
            ))}
          </SelectField>
          {pendingAction === 'warning' && (
            <div className="rounded-control border border-line-strong p-3">
              <p className="font-semibold">Issue this warning?</p>
              <p className="mt-1 text-sm text-ink-muted">
                The warning and reason will be recorded in the rider&apos;s account history.
              </p>
              <Button type="button" variant="secondary" onClick={() => setPendingAction(null)}>
                Cancel
              </Button>
            </div>
          )}
          <Button
            type="submit"
            disabled={disabled || (pendingAction !== null && pendingAction !== 'warning')}
          >
            {busy ? 'Saving…' : pendingAction === 'warning' ? 'Confirm warning' : 'Review warning'}
          </Button>
        </form>

        {suspended ? (
          <form
            noValidate
            onSubmit={reactivate}
            aria-label="Reactivate rider account"
            className="flex flex-col gap-4 rounded-panel border border-line p-4 sm:p-5"
          >
            <h3 className="text-lg font-bold">Reactivate account</h3>
            <p className="text-sm text-ink-muted">
              Lifting the active suspension preserves its history and requires a reason.
            </p>
            <TextAreaField
              label="Reason for reactivation"
              value={reactivationReason}
              maxLength={ENFORCEMENT_RULES.reasonMax}
              rows={3}
              onChange={(event) => {
                setReactivationReason(event.target.value);
                setPendingAction(null);
              }}
            />
            {reactivationErrors.reason && (
              <p className="text-sm text-danger">{reactivationErrors.reason}</p>
            )}
            {pendingAction === 'reactivation' && (
              <div className="rounded-control border border-line-strong p-3">
                <p className="font-semibold">Reactivate this rider?</p>
                <p className="mt-1 text-sm text-ink-muted">
                  The active suspension will end and remain in the rider&apos;s history.
                </p>
                <Button type="button" variant="secondary" onClick={() => setPendingAction(null)}>
                  Cancel
                </Button>
              </div>
            )}
            <Button
              type="submit"
              disabled={disabled || (pendingAction !== null && pendingAction !== 'reactivation')}
            >
              {busy
                ? 'Saving…'
                : pendingAction === 'reactivation'
                  ? 'Confirm reactivation'
                  : 'Review reactivation'}
            </Button>
          </form>
        ) : (
          <form
            noValidate
            onSubmit={suspend}
            aria-label="Suspend rider account"
            className="flex flex-col gap-4 rounded-panel border border-line p-4 sm:p-5"
          >
            <h3 className="text-lg font-bold">Suspend account</h3>
            <SelectField
              label="Reason category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as ComplaintCategory | '');
                setPendingAction(null);
              }}
              error={suspensionErrors.reasonCategory}
            >
              <option value="">Choose a reason category</option>
              {Object.entries(complaintCategoryLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <TextAreaField
              label="Reason"
              value={suspensionReason}
              maxLength={ENFORCEMENT_RULES.reasonMax}
              rows={3}
              onChange={(event) => {
                setSuspensionReason(event.target.value);
                setPendingAction(null);
              }}
            />
            {suspensionErrors.reason && (
              <p className="text-sm text-danger">{suspensionErrors.reason}</p>
            )}
            <SelectField
              label="Related complaint (optional)"
              value={complaintId}
              onChange={(event) => {
                setComplaintId(event.target.value);
                setPendingAction(null);
              }}
              error={suspensionErrors.complaintId}
            >
              <option value="">No linked complaint</option>
              {complaints.map((complaint) => (
                <option value={complaint.id} key={complaint.id}>
                  {complaint.reference} · {complaintCategoryLabels[complaint.category]}
                </option>
              ))}
            </SelectField>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={indefinite}
                onChange={(event) => {
                  setIndefinite(event.target.checked);
                  setPendingAction(null);
                }}
              />
              <span className="font-semibold">Indefinite suspension</span>
            </label>
            {!indefinite && (
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Suspension length in days
                <input
                  type="number"
                  min={ENFORCEMENT_RULES.minDays}
                  max={ENFORCEMENT_RULES.maxDays}
                  step={1}
                  required
                  value={days}
                  onChange={(event) => {
                    setDays(event.target.value);
                    setPendingAction(null);
                  }}
                  aria-invalid={suspensionErrors.length ? true : undefined}
                  className="min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base font-normal"
                />
              </label>
            )}
            {suspensionErrors.length && (
              <p className="text-sm text-danger">{suspensionErrors.length}</p>
            )}
            {pendingAction === 'suspension' && (
              <div className="rounded-control border border-line-strong p-3">
                <p className="font-semibold">
                  Suspend this rider {indefinite ? 'indefinitely' : `for ${days} days`}?
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  The suspension and reason will be recorded in the rider&apos;s account history.
                </p>
                <Button type="button" variant="secondary" onClick={() => setPendingAction(null)}>
                  Cancel
                </Button>
              </div>
            )}
            <Button
              type="submit"
              disabled={disabled || (pendingAction !== null && pendingAction !== 'suspension')}
            >
              {busy
                ? 'Saving…'
                : pendingAction === 'suspension'
                  ? 'Confirm suspension'
                  : 'Review suspension'}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
