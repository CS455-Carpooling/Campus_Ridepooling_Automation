import type { ComponentProps } from 'react';
import { cx } from '@/lib/cx';
import { useFieldIds } from './field-ids';

export type FieldProps = ComponentProps<'input'> & {
  label: string;
  hint?: string;
  hintPosition?: 'before' | 'after';
  error?: string;
};

/**
 * Labelled text input. The hint and error are linked to the input with
 * aria-describedby, and an error is shown as text, not by colour alone.
 */
export function Field({
  label,
  hint,
  hintPosition = 'before',
  error,
  id,
  className,
  ...inputProps
}: FieldProps) {
  const { controlId: inputId, hintId, errorId, describedBy } = useFieldIds(id, hint, error);
  const hintElement = hint && (
    <p id={hintId} className="text-sm text-ink-muted">
      {hint}
    </p>
  );

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      {hintPosition === 'before' && hintElement}
      <input
        {...inputProps}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(
          'min-h-12 rounded-control border bg-surface px-3 text-base text-ink',
          error ? 'border-danger' : 'border-line-strong',
        )}
      />
      {hintPosition === 'after' && hintElement}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
