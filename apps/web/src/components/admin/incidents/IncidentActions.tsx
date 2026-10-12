'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { routes } from '@/lib/routes';
import { SOS_RULES, incidentActionMessages, type IncidentStatus } from '@/lib/sos-rules';

/**
 * Acknowledge an SOS alert, then close it with a note on how it was handled (CS455-65). Each is
 * audited on the server. The page shows the result only after the server confirms it.
 */
export function IncidentActions({
  incidentId,
  status,
}: {
  incidentId: string;
  status: IncidentStatus;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = sending || refreshing;

  async function send(body: object) {
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/incidents/${encodeURIComponent(incidentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.push(routes.login);
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Unable to update the incident right now.');
        return;
      }
      setNote('');
      startTransition(() => router.refresh());
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  function close() {
    const trimmed = note.trim();
    if (!trimmed || Array.from(trimmed).length > SOS_RULES.closeNoteMax) {
      setNoteError(incidentActionMessages.note);
      return;
    }
    setNoteError('');
    void send({ action: 'close', note: trimmed });
  }

  if (status === 'closed') return null;
  return (
    <section aria-labelledby="incident-actions-heading" className="mt-10">
      <h2 id="incident-actions-heading" className="text-xl font-bold tracking-tight">
        Handle this alert
      </h2>
      {status === 'open' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button onClick={() => send({ action: 'acknowledge' })} disabled={busy}>
            {busy ? 'Saving…' : 'Acknowledge'}
          </Button>
          <p className="text-sm text-ink-muted">
            Tells the other admins someone is on it, and clears the alert bar.
          </p>
        </div>
      )}
      <div className="mt-6 flex max-w-2xl flex-col gap-3">
        <div className="flex flex-col gap-1">
          <TextAreaField
            label="How was it handled?"
            hint={`Needed to close the alert. At most ${SOS_RULES.closeNoteMax} characters.`}
            value={note}
            maxLength={SOS_RULES.closeNoteMax}
            rows={4}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={noteError ? true : undefined}
          />
          {noteError && <p className="text-sm text-danger">{noteError}</p>}
        </div>
        <div>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Close the alert
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
