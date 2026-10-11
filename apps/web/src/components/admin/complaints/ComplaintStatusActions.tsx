'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { sendAdminChange } from '@/components/admin/config/admin-request';
import { Button } from '@/components/ui/Button';
import { ChoiceCards } from '@/components/ui/ChoiceCards';
import { TextAreaField } from '@/components/ui/TextAreaField';
import {
  COMPLAINT_NOTE_MAX,
  parseComplaintStatusChange,
  type ComplaintStatus,
} from '@/lib/complaint-rules';
import { routes } from '@/lib/routes';

/**
 * Moving a complaint along (CS455-53, OA-FR-18, FR-RD-13.5): under review, then resolved with
 * whether any action was taken. Resolving is final, and the person who complained is told only
 * whether action was taken. After each change the page reads the complaint again.
 */
export function ComplaintStatusActions({
  complaintId,
  status,
  version,
}: {
  complaintId: string;
  status: ComplaintStatus;
  version: number;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [actionTaken, setActionTaken] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const busy = sending || refreshing;

  async function change(body: Record<string, unknown>) {
    const parsed = parseComplaintStatusChange({ ...body, version });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setMessage('');
    setSending(true);
    const result = await sendAdminChange(
      'PATCH',
      `/api/admin/complaints/${complaintId}`,
      parsed.value,
    );
    setSending(false);
    if (result.ok) {
      setNote('');
      setActionTaken('');
      startTransition(() => router.refresh());
      return;
    }
    if (result.status === 401) {
      router.push(routes.login);
      return;
    }
    if (result.code === 'version_conflict' || result.code === 'not_allowed') {
      // Another admin moved it meanwhile: show the complaint as it is now, keeping the note.
      setMessage(`${result.error} The page now shows the complaint as it is.`);
      startTransition(() => router.refresh());
      return;
    }
    setErrors(result.fields);
    setMessage(result.error);
  }

  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change({
      status: 'resolved',
      actionTaken: actionTaken === 'yes' ? true : actionTaken === 'no' ? false : undefined,
      note,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {status === 'submitted' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void change({ status: 'under_review', note })}
          >
            {busy ? 'Saving…' : 'Mark under review'}
          </Button>
          <p className="text-sm text-ink-muted">
            Tells the person who complained that someone is looking at it.
          </p>
        </div>
      )}
      <form
        noValidate
        onSubmit={resolve}
        aria-label="Resolve this complaint"
        className="flex flex-col gap-5 rounded-panel border border-line p-5 sm:p-6"
      >
        <h3 className="text-lg font-bold tracking-tight">Resolve this complaint</h3>
        <ChoiceCards
          legend="Was any action taken?"
          name="actionTaken"
          value={actionTaken}
          onChange={setActionTaken}
          error={errors.actionTaken}
          choices={[
            {
              value: 'yes',
              label: 'Yes, action was taken',
              description: 'For example a warning or a suspension',
            },
            { value: 'no', label: 'No action was taken', description: 'Nothing further is needed' },
          ]}
        />
        <div className="flex flex-col gap-1">
          <TextAreaField
            label="Note for the record (optional)"
            hint="Only admins see it. The person who complained is told only whether action was taken."
            value={note}
            maxLength={COMPLAINT_NOTE_MAX}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
          />
          {errors.note && <p className="text-sm text-danger">{errors.note}</p>}
        </div>
        {message && (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Resolve complaint'}
          </Button>
          <p className="text-sm text-ink-muted">Resolving is final.</p>
        </div>
      </form>
    </div>
  );
}
