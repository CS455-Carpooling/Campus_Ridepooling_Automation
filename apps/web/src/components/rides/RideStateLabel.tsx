import { cx } from '@/lib/cx';
import { rideStateLabels, type RideState } from '@/lib/ride-status';

// Each state looks different, and always carries its name as text (NFR-RO-USE-04).
const stateClasses: Record<RideState, string> = {
  scheduled: 'border-line-strong text-ink',
  pickup_in_progress: 'border-accent bg-accent text-on-accent',
  in_transit: 'border-accent bg-accent text-on-accent',
  completed: 'border-line-strong bg-panel text-ink-muted',
  cancelled: 'border-danger text-danger',
};

/** A ride's state as a small text label (FR-RD-10.1). */
export function RideStateLabel({ state, className }: { state: RideState; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-semibold',
        stateClasses[state],
        className,
      )}
    >
      {rideStateLabels[state]}
    </span>
  );
}
