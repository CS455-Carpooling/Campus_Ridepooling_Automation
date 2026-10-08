import { cx } from '@/lib/cx';
import { scoreChoices } from '@/lib/rating-rules';

export type ScoreFieldProps = {
  /** Shown above the scores, for example "Score". */
  legend: string;
  /** Added to the group's name for screen readers, for example "for Ananya Rao". */
  legendDetail?: string;
  /** The radio group's name: one per person rated. */
  name: string;
  /** The chosen score, or 0 when none is chosen yet. */
  value: number;
  onChange: (score: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A score from 1 to 5 (FR-RD-12.1) as five numbered boxes in a row. Each box
 * is a label around a real radio button, so arrow keys and screen readers
 * behave natively; the word for each score (Poor to Excellent) is read out
 * with its number. No star glyphs: the number is the score.
 */
export function ScoreField({
  legend,
  legendDetail,
  name,
  value,
  onChange,
  disabled,
  className,
}: ScoreFieldProps) {
  const chosen = scoreChoices.find((choice) => choice.score === value);
  const chosenText = chosen ? `${chosen.score}, ${chosen.label}` : 'not chosen';

  return (
    <fieldset
      disabled={disabled}
      // With a detail, the group's name adds it: "Score for Ananya Rao: 4, Very good".
      aria-label={legendDetail ? `${legend} ${legendDetail}: ${chosenText}` : undefined}
      className={cx('min-w-0', className)}
    >
      <legend className="text-sm font-semibold">
        {legend}:{' '}
        {chosen ? (
          <span>
            {chosen.score}, {chosen.label}
          </span>
        ) : (
          <span className="font-normal text-ink-muted">not chosen</span>
        )}
      </legend>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {scoreChoices.map((choice) => {
          const checked = choice.score === value;
          return (
            <label key={choice.score} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={choice.score}
                checked={checked}
                onChange={() => onChange(choice.score)}
                className="peer sr-only"
              />
              <span
                className={cx(
                  'flex min-h-12 items-center justify-center rounded-control border-2',
                  'font-mono text-lg font-semibold tabular-nums',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink',
                  checked
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-line-strong bg-surface text-ink hover:border-ink',
                )}
              >
                {choice.score}
                <span className="sr-only">, {choice.label}</span>
              </span>
            </label>
          );
        })}
      </div>
      {/* The words are already read with each number, so this scale is for sighted users only. */}
      <div aria-hidden="true" className="mt-1.5 flex justify-between gap-4 text-sm text-ink-muted">
        <span>1 Poor</span>
        <span>5 Excellent</span>
      </div>
    </fieldset>
  );
}
