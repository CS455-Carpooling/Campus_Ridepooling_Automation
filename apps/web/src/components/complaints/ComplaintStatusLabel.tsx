import { complaintStatusLabels, type ComplaintStatus } from '@/lib/complaint-rules';
import { cx } from '@/lib/cx';

// Each status looks different, and always carries its name as text (FR-RD-13.5, SYS-NFR-12).
const statusClasses: Record<ComplaintStatus, string> = {
  submitted: 'border-accent text-accent-text',
  under_review: 'border-line-strong text-ink',
  resolved: 'border-line-strong bg-panel text-ink-muted',
};

/** A complaint's status as a small text label. */
export function ComplaintStatusLabel({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-semibold',
        statusClasses[status],
      )}
    >
      {complaintStatusLabels[status]}
    </span>
  );
}
