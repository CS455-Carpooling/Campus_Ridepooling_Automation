'use client';

import { useState } from 'react';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { routes } from '@/lib/routes';

type ChatComplaint = {
  reference: string;
  ride_id: string;
  message_id: string;
  reporter_name: string;
  sender_name: string;
  body: string;
  reason: string;
  created_at: string;
};

export function ChatComplaintQueue({ initialReports }: { initialReports: ChatComplaint[] }) {
  const [reports, setReports] = useState(initialReports);
  const [error, setError] = useState('');
  const [busyReference, setBusyReference] = useState('');

  async function resolve(reference: string) {
    setBusyReference(reference);
    setError('');
    try {
      const response = await fetch('/api/admin/chat-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Complaint could not be resolved.');
      setReports((current) => current.filter((report) => report.reference !== reference));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Complaint could not be resolved.');
    } finally {
      setBusyReference('');
    }
  }

  return (
    <DesignSystem className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Ride chat complaints</h1>
        <div className="flex gap-3">
          <ButtonLink href={routes.home} variant="secondary">
            Dashboard
          </ButtonLink>
          <LogoutButton />
        </div>
      </header>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      {reports.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No open ride chat complaints.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reports.map((report) => (
            <li key={report.reference} className="rounded-panel border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">
                  {report.reference}: {report.reason}
                </h2>
                <time className="text-xs text-ink-muted" dateTime={report.created_at}>
                  {new Date(report.created_at).toLocaleString()}
                </time>
              </div>
              <p className="mt-2 text-sm">
                Reported by {report.reporter_name} · Message from {report.sender_name}
              </p>
              <blockquote className="mt-3 whitespace-pre-wrap rounded-control bg-panel p-3 text-sm">
                {report.body}
              </blockquote>
              <p className="mt-2 break-all text-xs text-ink-muted">
                Ride {report.ride_id} · Message {report.message_id}
              </p>
              <button
                type="button"
                disabled={busyReference === report.reference}
                onClick={() => void resolve(report.reference)}
                className="mt-3 rounded-control border border-primary bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
              >
                {busyReference === report.reference ? 'Resolving…' : 'Mark resolved'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </DesignSystem>
  );
}
