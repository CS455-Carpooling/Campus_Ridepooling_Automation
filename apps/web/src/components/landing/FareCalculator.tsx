'use client';

import { useState } from 'react';
import { Field } from '@/components/ui/Field';
import { estimateShare, splitFare } from '@/lib/fare';
import { formatRupees } from '@/lib/format';

// Limits of this demonstration only. In the app, the total comes from the fare
// band for the destination and vehicle type (FR-RD-08.5).
const MIN_TOTAL = 1;
const MAX_TOTAL = 50_000;
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 8;

type Parsed = { ok: true; value: number } | { ok: false; error: string };

function parseWholeNumber(text: string, min: number, max: number, error: string): Parsed {
  const trimmed = text.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return { ok: false, error };
  const value = Number(trimmed);
  return value >= min && value <= max ? { ok: true, value } : { ok: false, error };
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

export type FareCalculatorProps = {
  initialTotal?: number;
  initialPeople?: number;
};

/**
 * Live demonstration of the fare split (D1 Table T-2): enter a total fare and
 * the number of people, and see each person's share in whole rupees. The
 * defaults are the worked example in D1.
 */
export function FareCalculator({ initialTotal = 350, initialPeople = 3 }: FareCalculatorProps) {
  const [totalText, setTotalText] = useState(String(initialTotal));
  const [peopleText, setPeopleText] = useState(String(initialPeople));

  const total = parseWholeNumber(
    totalText,
    MIN_TOTAL,
    MAX_TOTAL,
    `Enter whole rupees from ${formatRupees(MIN_TOTAL)} to ${formatRupees(MAX_TOTAL)}.`,
  );
  const people = parseWholeNumber(
    peopleText,
    MIN_PEOPLE,
    MAX_PEOPLE,
    `Enter a number from ${MIN_PEOPLE} to ${MAX_PEOPLE}, counting the owner.`,
  );

  return (
    <form aria-label="Fare split" noValidate onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Total fare (₹)"
          inputMode="numeric"
          autoComplete="off"
          value={totalText}
          onChange={(event) => setTotalText(event.target.value)}
          error={total.ok ? undefined : total.error}
        />
        <Field
          label="People in the ride"
          inputMode="numeric"
          autoComplete="off"
          value={peopleText}
          onChange={(event) => setPeopleText(event.target.value)}
          error={people.ok ? undefined : people.error}
        />
      </div>
      <div aria-live="polite" className="mt-5">
        {total.ok && people.ok ? (
          <FareShares total={total.value} people={people.value} />
        ) : (
          <p className="text-sm text-ink-muted">Correct the entries above to see each share.</p>
        )}
      </div>
    </form>
  );
}

function FareShares({ total, people }: { total: number; people: number }) {
  const shares = splitFare(total, people);
  const extra = total % people;

  return (
    <>
      <ol
        aria-label="Each person's share"
        className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2"
      >
        {shares.map((share, index) => (
          <li key={index} className="rounded-control border border-line px-3 py-2">
            <span className="block text-xs font-semibold text-ink-muted">
              {occupantLabel(index)}
            </span>
            <span className="block font-mono text-lg font-medium tabular-nums">
              {formatRupees(share)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-ink-muted">
        {extra === 0
          ? `${formatRupees(total)} divides evenly, so everyone pays ${formatRupees(shares[0])}.`
          : `${formatRupees(total)} does not divide evenly, so ${payingMore(extra)} ${formatRupees(1)} more. The shares still add up to ${formatRupees(total)}.`}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Before asking to join, the next rider sees an estimate of{' '}
        <span className="font-mono text-ink tabular-nums">
          {formatRupees(estimateShare(total, people))}
        </span>
        .
      </p>
    </>
  );
}
