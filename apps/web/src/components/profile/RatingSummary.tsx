import { formatRating } from '@/lib/format';
import { RATING_RULES, type OwnRating } from '@/lib/rating-rules';

const threshold = RATING_RULES.minRatingsToShow;

/**
 * The rating line in the profile's rider preview (CS455-44, FR-RD-02.4): the
 * average others see, or how far the person is from having one. Ratings count
 * once each ride's 72 hours of rating are over.
 */
export function YourRating({ rating }: { rating: OwnRating }) {
  let text: string;
  if (rating.average !== null) {
    text = `Rating: ${formatRating({ average: rating.average, count: rating.count })}.`;
  } else if (rating.count === 0) {
    text = `Rating: none yet. Others see your average once you have ${threshold} ratings.`;
  } else {
    text = `Rating: ${rating.count} of ${threshold} ratings so far. Others see your average once you have ${threshold}.`;
  }
  return <p className="mt-3 text-sm text-ink-muted">{text}</p>;
}

/**
 * The comments people left when rating the viewer (CS455-44). Only the viewer
 * sees them, without names, scores or dates, and only from 3 ratings up, so a
 * comment cannot be traced to whoever wrote it.
 */
export function CommentsAboutYou({ rating }: { rating: OwnRating }) {
  return (
    <section
      aria-labelledby="comments-about-you-heading"
      className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="comments-about-you-heading" className="text-xl font-bold">
        Comments about you
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Only you can see these. They come without names, scores or dates, and appear once you have{' '}
        {threshold} ratings and each ride&apos;s 72 hours of rating are over.
      </p>
      {rating.comments.length === 0 ? (
        <p className="mt-4 text-ink-muted">
          {rating.average === null ? 'None to show yet.' : 'Nobody has left a comment yet.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rating.comments.map((comment, index) => (
            <li key={index} className="rounded-control bg-panel px-4 py-3 whitespace-pre-line">
              {comment}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
