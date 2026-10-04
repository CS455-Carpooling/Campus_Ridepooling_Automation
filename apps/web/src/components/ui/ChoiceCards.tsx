import { cx } from '@/lib/cx';
import { useFieldIds } from './field-ids';

export type Choice = {
  value: string;
  label: string;
  /** A second line under the label, linked to the radio for screen readers. */
  description?: string;
};

export type ChoiceCardsProps = {
  legend: string;
  name: string;
  choices: Choice[];
  /** The chosen value, or '' when nothing is chosen yet. */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  /** Columns from the sm breakpoint up; one column on phones. */
  columns?: 1 | 2;
  className?: string;
};

const columnClasses = { 1: '', 2: 'sm:grid-cols-2' } as const;

/**
 * One choice from a short list, shown as cards. Each card is a label around a
 * real radio button, so arrow keys, focus and screen readers behave natively.
 * The chosen card gets the primary border and a filled background; the radio
 * dot shows the choice too, so it is never told by colour alone.
 */
export function ChoiceCards({
  legend,
  name,
  choices,
  value,
  onChange,
  hint,
  error,
  columns = 2,
  className,
}: ChoiceCardsProps) {
  const { controlId, hintId, errorId, describedBy } = useFieldIds(undefined, hint, error);

  return (
    <fieldset aria-describedby={describedBy} className={className}>
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      <div className={cx('mt-2 grid gap-2', columnClasses[columns])}>
        {choices.map((choice) => {
          const checked = choice.value === value;
          const labelId = `${controlId}-${choice.value}-label`;
          const descriptionId = choice.description
            ? `${controlId}-${choice.value}-description`
            : undefined;
          return (
            <label
              key={choice.value}
              className={cx(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border-2 px-4 py-3',
                checked
                  ? 'border-primary bg-panel'
                  : 'border-line-strong bg-surface hover:border-ink',
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={checked}
                onChange={() => onChange(choice.value)}
                // Named by the label alone; the second line is its description.
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <span className="flex flex-col">
                <span id={labelId} className="font-semibold">
                  {choice.label}
                </span>
                {choice.description && (
                  <span id={descriptionId} className="text-sm text-ink-muted">
                    {choice.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
