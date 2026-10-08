import type { ComponentProps } from 'react';
import { cx } from '@/lib/cx';
import { useFieldIds } from './field-ids';

export type TextAreaFieldProps = Omit<ComponentProps<'textarea'>, 'value' | 'maxLength'> & {
  label: string;
  hint?: string;
  value: string;
  /** The most characters allowed; the count under the box shows how many are used. */
  maxLength: number;
};

/**
 * Labelled multi-line text box with a character count, wired like Field: the
 * hint and the count are linked to the box with aria-describedby. Characters
 * are counted as PostgreSQL counts them, so an emoji counts once.
 */
export function TextAreaField({
  label,
  hint,
  value,
  maxLength,
  id,
  className,
  rows = 4,
  ...textareaProps
}: TextAreaFieldProps) {
  const { controlId, hintId, describedBy } = useFieldIds(id, hint);
  const countId = `${controlId}-count`;

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={controlId} className="text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      <textarea
        {...textareaProps}
        id={controlId}
        rows={rows}
        value={value}
        maxLength={maxLength}
        aria-describedby={[describedBy, countId].filter(Boolean).join(' ')}
        className="min-h-26 resize-y rounded-control border border-line-strong bg-surface px-3 py-2.5 text-base text-ink"
      />
      <p id={countId} className="text-right font-mono text-sm text-ink-muted tabular-nums">
        {Array.from(value).length} of {maxLength} characters
      </p>
    </div>
  );
}
