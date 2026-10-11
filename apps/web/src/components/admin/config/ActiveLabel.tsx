import { cx } from '@/lib/cx';

/** Whether a vehicle type or place is offered for new rides, as a small text label. */
export function ActiveLabel({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-semibold',
        active ? 'border-line-strong text-ink' : 'border-line-strong bg-panel text-ink-muted',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
