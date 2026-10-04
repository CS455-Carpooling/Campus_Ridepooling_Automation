'use client';

import { useId, useState } from 'react';
import { estimateShare, splitFare } from '@/lib/fare';
import { formatRupees } from '@/lib/format';

// Limits of this demonstration only. In the app, the total comes from the fare band.
const MIN_TOTAL = 1;
const MAX_TOTAL = 50_000;
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 8;

function parseTotal(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= MIN_TOTAL && value <= MAX_TOTAL ? value : null;
}

function occupantLabel(index: number): string {
  return index === 0 ? 'Owner' : `Rider ${index}`;
}

/** Who pays the extra rupee: the owner first, then riders in order of acceptance. */
function payingMore(count: number): string {
  if (count === 1) return 'the owner pays';
  if (count === 2) return 'the owner and rider 1 pay';
  return `the owner and riders 1 to ${count - 1} pay`;
}

export type FareSplitCardProps = {
  initialTotal?: number;
  initialPeople?: number;
};

export function FareSplitCard({ initialTotal = 350, initialPeople = 3 }: FareSplitCardProps) {
  const id = useId();
  const [totalText, setTotalText] = useState(String(initialTotal));
  const [people, setPeople] = useState(initialPeople);
  const total = parseTotal(totalText);

  const totalId = `${id}-total`;
  const errorId = `${id}-error`;
  const peopleId = `${id}-people`;

  return (
    <form aria-label="Fare split" noValidate onSubmit={(event) => event.preventDefault()}>
      <div className="fs-controls">
        <div>
          <label className="fs-label" htmlFor={totalId}>
            Total fare (₹)
          </label>
          <div className="fs-input">
            <b aria-hidden="true">₹</b>
            <input
              id={totalId}
              inputMode="numeric"
              autoComplete="off"
              value={totalText}
              onChange={(event) => setTotalText(event.target.value)}
              aria-invalid={total === null}
              aria-describedby={total === null ? errorId : undefined}
            />
          </div>
          {total === null && (
            <small id={errorId} className="fs-error">
              Enter whole rupees from {formatRupees(MIN_TOTAL)} to {formatRupees(MAX_TOTAL)}.
            </small>
          )}
        </div>

        <div>
          <span className="fs-label" id={peopleId}>
            People sharing
          </span>
          <div className="fs-stepper" role="group" aria-labelledby={peopleId}>
            <button
              type="button"
              aria-label="Fewer people"
              disabled={people <= MIN_PEOPLE}
              onClick={() => setPeople((count) => Math.max(MIN_PEOPLE, count - 1))}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2 5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <output>
              <strong>{people}</strong>
              <small>including owner</small>
            </output>
            <button
              type="button"
              aria-label="More people"
              disabled={people >= MAX_PEOPLE}
              onClick={() => setPeople((count) => Math.min(MAX_PEOPLE, count + 1))}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path
                  d="M2 5h6M5 2v6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="fs-result" aria-live="polite">
        {total === null ? (
          <p className="fs-empty">Correct the fare above to see each share.</p>
        ) : (
          <Shares total={total} people={people} />
        )}
      </div>
    </form>
  );
}

function Shares({ total, people }: { total: number; people: number }) {
  const shares = splitFare(total, people);
  const extra = total % people;

  return (
    <>
      <div className="fs-result-head">
        <div>
          <span>Estimated share</span>
          <strong>
            {formatRupees(shares[0])} <small>/ person</small>
          </strong>
        </div>
        <span className="fs-badge">{extra === 0 ? 'Even split' : 'Fair split'}</span>
      </div>
      <ol aria-label="Each person's share" className="fs-shares">
        {shares.map((share, index) => (
          <li key={index} className={index === 0 ? 'fs-owner' : undefined}>
            <span>{occupantLabel(index)}</span>
            <strong>{formatRupees(share)}</strong>
          </li>
        ))}
      </ol>
      <p className="fs-note">
        {extra === 0
          ? `${formatRupees(total)} divides evenly, so everyone pays ${formatRupees(shares[0])}.`
          : `${formatRupees(total)} does not divide evenly, so ${payingMore(extra)} ${formatRupees(1)} more. The shares still add up to ${formatRupees(total)}.`}
      </p>
      <p className="fs-note">
        Before asking to join, the next rider sees an estimate of{' '}
        <b>{formatRupees(estimateShare(total, people))}</b>.
      </p>
    </>
  );
}
