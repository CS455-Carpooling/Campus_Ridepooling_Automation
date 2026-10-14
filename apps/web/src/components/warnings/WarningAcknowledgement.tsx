'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { complaintCategoryLabels } from '@/lib/complaint-rules';
import type { PendingRiderWarning } from '@/lib/warnings';

export function WarningAcknowledgement({ warnings }: { warnings: PendingRiderWarning[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge(id: string) {
    setSaving(id);
    setError(null);
    try {
      const response = await fetch(`/api/warnings/${encodeURIComponent(id)}/acknowledge`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Unable to acknowledge this warning.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to acknowledge this warning.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <section
        aria-labelledby="warning-heading"
        className="ds-card rounded-panel border border-line p-6"
      >
        <h1 id="warning-heading" className="text-2xl font-bold">
          Please review your account warning{warnings.length === 1 ? '' : 's'}
        </h1>
        <p className="mt-3 text-ink-muted">
          Review and acknowledge each warning to continue using your account.
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {warnings.map((warning) => (
            <li key={warning.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <h2 className="font-semibold">
                  Reason category: {complaintCategoryLabels[warning.reasonCategory]}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Issued {new Date(warning.issuedAt).toLocaleDateString('en-IN')}
                </p>
              </div>
              <Button
                disabled={saving !== null}
                onClick={() => void acknowledge(warning.id)}
                aria-label={`Acknowledge ${complaintCategoryLabels[warning.reasonCategory]} warning`}
              >
                {saving === warning.id ? 'Saving…' : 'I acknowledge this warning'}
              </Button>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-4 text-danger-text">
            {error}
          </p>
        )}
      </section>
    </DesignSystem>
  );
}
