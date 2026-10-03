import type { ComponentProps } from 'react';
import { cx } from '@/lib/cx';
import { useFieldIds } from './field-ids';

export type SelectFieldProps = ComponentProps<'select'> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Labelled drop-down list, wired like Field: the hint and error are linked with
 * aria-describedby, and an error is shown as text, not by colour alone. It is
 * the browser's own select, so keyboard and screen reader behaviour are native.
 */
export function SelectField({
  label,
  hint,
  error,
  id,
  className,
  children,
  ...selectProps
}: SelectFieldProps) {
  const { controlId, hintId, errorId, describedBy } = useFieldIds(id, hint, error);

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
      <select
        {...selectProps}
        id={controlId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(
          'min-h-12 rounded-control border bg-surface px-3 text-base text-ink',
          error ? 'border-danger' : 'border-line-strong',
        )}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
