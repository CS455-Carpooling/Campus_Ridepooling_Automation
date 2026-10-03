'use client';

import { Field } from '@/components/ui/Field';
import { formatRupees } from '@/lib/format';
import { fareFromText, largestShare } from '@/lib/ride-rules';

export type FareInputProps = {
  /** The fare as typed. */
  value: string;
  onChange: (value: string) => void;
  /** Capacity of the chosen vehicle, the owner included; unknown until one is chosen. */
  capacity?: number;
  error?: string;
};

/** What each person pays, worked out with the same rule as the real shares (Table T-2). */
function shareText(fare: number | null, capacity: number | undefined): string {
  if (fare === null) return '';
  if (!capacity) return 'Choose a vehicle to see what each person pays.';
  const full = formatRupees(largestShare(fare, capacity) ?? 0);
  if (capacity <= 2) return `Each of you pays about ${full}.`;
  const two = formatRupees(largestShare(fare, 2) ?? 0);
  return `Each person pays about ${full} when all ${capacity} places are taken, or ${two} if one rider joins.`;
}

/**
 * The estimated total fare for the whole vehicle, in whole rupees, with each
 * person's share shown as it is typed.
 */
export function FareInput({ value, onChange, capacity, error }: FareInputProps) {
  const text = shareText(fareFromText(value), capacity);

  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Estimated total fare (₹)"
        hint="What the whole vehicle will cost, in whole rupees. Each rider pays a share of it."
        name="expectedTotalFare"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
      />
      <p aria-live="polite" className="min-h-5 text-sm text-ink-muted">
        {text}
      </p>
    </div>
  );
}
