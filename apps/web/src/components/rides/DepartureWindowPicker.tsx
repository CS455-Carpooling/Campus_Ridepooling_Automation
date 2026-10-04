'use client';

import { useId } from 'react';
import { Field } from '@/components/ui/Field';
import { formatDepartureWindow } from '@/lib/format';
import { addMinutesLocal, RIDE_RULES, toIstIso, type RideErrors } from '@/lib/ride-rules';

export type WindowValue = {
  /** datetime-local values in IST, such as "2026-10-10T06:30", or ''. */
  departureStart: string;
  departureEnd: string;
};

export type DepartureWindowPickerProps = {
  value: WindowValue;
  onChange: (change: Partial<WindowValue>) => void;
  /** The earliest start the rules allow (minDepartureLocal), worked out on the server. */
  earliest: string;
  errors?: Pick<RideErrors, 'departureStart' | 'departureEnd'>;
};

/**
 * When the ride leaves: a window rather than one time, so riders know when to
 * be ready. The browser's date pickers are limited to what the rules allow
 * (at least an hour ahead, at most 3 hours long); the rules check it again.
 */
export function DepartureWindowPicker({
  value,
  onChange,
  earliest,
  errors = {},
}: DepartureWindowPickerProps) {
  const hintId = useId();
  const start = toIstIso(value.departureStart);
  const end = toIstIso(value.departureEnd);
  const summary =
    start && end && new Date(end) > new Date(start) ? formatDepartureWindow(start, end) : null;

  return (
    <fieldset aria-describedby={hintId}>
      <legend className="text-sm font-semibold">When are you leaving?</legend>
      <p id={hintId} className="mt-1 text-sm text-ink-muted">
        Give a window of up to 3 hours, starting at least an hour from now, so riders know when to
        be ready.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field
          label="Earliest departure"
          type="datetime-local"
          name="departureStart"
          min={earliest}
          value={value.departureStart}
          onChange={(event) => onChange({ departureStart: event.target.value })}
          error={errors.departureStart}
        />
        <Field
          label="Latest departure"
          type="datetime-local"
          name="departureEnd"
          min={addMinutesLocal(value.departureStart, 1) || earliest}
          max={addMinutesLocal(value.departureStart, RIDE_RULES.maxWindowMinutes) || undefined}
          value={value.departureEnd}
          onChange={(event) => onChange({ departureEnd: event.target.value })}
          error={errors.departureEnd}
        />
      </div>
      {summary && (
        <p aria-live="polite" className="mt-3 text-sm text-ink-muted">
          Riders will see <span className="font-mono text-ink tabular-nums">{summary}</span>
        </p>
      )}
    </fieldset>
  );
}
