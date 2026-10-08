'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ScoreField } from '@/components/ui/ScoreField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { RATING_RULES, offersComplaint, parseRatingsRequest } from '@/lib/rating-rules';
import type { RatingPerson } from '@/lib/ride-ratings';
import { routes } from '@/lib/routes';

/** Where complaints go until the app has its own complaint form (FR-RD-12.4, in part). */
const CONTACT_EMAIL = 'campusridepooling@iitk.ac.in';

export type RatingFormProps = {
  rideId: string;
  /** The people the viewer has not rated yet. */
  people: RatingPerson[];
  /** When rating closes, already formatted, for example "Tue 13 Oct, 08:05". */
  closesAt: string;
  /** "Pickup" when leaving campus, "Drop-off" when coming back. */
  placeLabel: string;
};

/**
 * The rating form on the review page (CS455-43, FR-RD-12.1 to 12.4). One card
 * per person not rated yet: a score from 1 to 5 and an optional comment. Only
 * the people given a score are sent, so the rest can be rated later while
 * rating is open. It checks the request with the same rules as the API, then
 * reads the page again, which moves the people just rated to "Already rated".
 */
export function RatingForm({ rideId, people, closesAt, placeLabel }: RatingFormProps) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = sending || refreshing;

  const scored = people.filter((person) => (scores[person.occupantId] ?? 0) > 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (scored.length === 0) {
      setError('Choose a score for at least one person first.');
      return;
    }
    const checked = parseRatingsRequest({
      ratings: scored.map((person) => ({
        occupantId: person.occupantId,
        score: scores[person.occupantId],
        comment: comments[person.occupantId] ?? '',
      })),
    });
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratings: checked.ratings }),
      });
      if (response.status === 401) {
        router.push(routes.login);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string; rated?: number };
      if (!response.ok) {
        setError(data.error ?? 'Unable to send the ratings right now.');
        // The page is out of date (rating closed, or someone already rated): show what is true now.
        if (response.status === 409) startTransition(() => router.refresh());
        return;
      }
      const count = data.rated ?? checked.ratings.length;
      setNotice(count === 1 ? 'Rating sent for 1 person.' : `Ratings sent for ${count} people.`);
      startTransition(() => router.refresh());
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} aria-labelledby="rate-heading" className="mt-10">
      <h2 id="rate-heading" className="text-xl font-bold tracking-tight">
        The people you travelled with
      </h2>
      <div aria-live="polite">
        {notice && (
          <p className="mt-4 rounded-control bg-panel px-4 py-3 font-semibold">{notice}</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {people.map((person) => {
          const score = scores[person.occupantId] ?? 0;
          const headingId = `person-${person.occupantId}`;
          return (
            <section
              key={person.occupantId}
              aria-labelledby={headingId}
              className="rounded-panel border border-line p-4 sm:p-5"
            >
              <h3 id={headingId} className="text-lg font-bold">
                {person.name}{' '}
                <span className="font-medium text-ink-muted">
                  ({person.isOwner ? 'Ride owner' : 'Rider'})
                </span>
              </h3>
              <p className="text-sm text-ink-muted">
                {placeLabel}: {person.campusPlace}
              </p>

              <ScoreField
                className="mt-5"
                legend="Score"
                legendDetail={`for ${person.name}`}
                name={`score-${person.occupantId}`}
                value={score}
                disabled={busy}
                onChange={(next) => {
                  setScores((current) => ({ ...current, [person.occupantId]: next }));
                  setError('');
                }}
              />

              {offersComplaint(score) && (
                <div className="mt-4 rounded-control bg-panel p-4">
                  <p className="font-bold">Was there a problem on this trip?</p>
                  <p className="mt-1 text-sm">
                    Reporting a problem in the app is coming later. For now, write to{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent-text">
                      {CONTACT_EMAIL}
                    </a>{' '}
                    with the ride date and what happened. Your score is sent either way.
                  </p>
                </div>
              )}

              <TextAreaField
                className="mt-5"
                label="Comment (optional)"
                hint={`Only ${person.name} will see this, without your name or score, once they have 3 ratings.`}
                value={comments[person.occupantId] ?? ''}
                maxLength={RATING_RULES.commentMaxLength}
                disabled={busy}
                onChange={(event) => {
                  const text = event.target.value;
                  setComments((current) => ({ ...current, [person.occupantId]: text }));
                }}
              />
            </section>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-6">
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send ratings'}
        </Button>
        <p className="grow basis-60 text-sm text-ink-muted">
          {scored.length} of {people.length} scored. Anyone you skip can still be rated until{' '}
          {closesAt}.
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
