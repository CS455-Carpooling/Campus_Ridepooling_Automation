import { cx } from '@/lib/cx';
import { incidentStatusLabels, type IncidentStatus } from '@/lib/sos-rules';

// Open stands out, and every status carries its name as text (SYS-NFR-12).
const statusClasses: Record<IncidentStatus, string> = {
  open: 'border-danger bg-danger text-on-primary',
  acknowledged: 'border-line-strong text-ink',
  closed: 'border-line-strong bg-panel text-ink-muted',
};

/** An SOS incident's status as a small text label (CS455-65). */
export function IncidentStatusLabel({ status }: { status: IncidentStatus }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-semibold',
        statusClasses[status],
      )}
    >
      {incidentStatusLabels[status]}
    </span>
  );
}
