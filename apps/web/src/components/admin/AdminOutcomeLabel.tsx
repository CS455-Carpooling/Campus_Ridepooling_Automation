import { adminOutcomeLabels, type AdminOutcome } from '@/lib/admin-activity';
import { cx } from '@/lib/cx';

// Each outcome looks different, and always carries its name as text (SYS-NFR-12).
const outcomeClasses: Record<AdminOutcome, string> = {
  succeeded: 'border-line-strong text-ink',
  refused: 'border-line-strong bg-panel text-ink-muted',
  failed: 'border-danger text-danger',
};

/** Whether an admin action was done, refused or failed, as a small text label. */
export function AdminOutcomeLabel({ outcome }: { outcome: AdminOutcome }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-semibold',
        outcomeClasses[outcome],
      )}
    >
      {adminOutcomeLabels[outcome]}
    </span>
  );
}
