import { useId, type ComponentProps } from 'react';
import { cx } from '@/lib/cx';

export type FieldProps = ComponentProps<'input'> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Labelled text input. The hint and error are linked to the input with
 * aria-describedby, and an error is shown as text, not by colour alone.
 */
export function Field({ label, hint, error, id, className, ...inputProps }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      <input
        {...inputProps}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(
          'min-h-11 rounded-sm border bg-paper px-3 text-base text-ink',
          error ? 'border-danger' : 'border-line-strong',
        )}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
