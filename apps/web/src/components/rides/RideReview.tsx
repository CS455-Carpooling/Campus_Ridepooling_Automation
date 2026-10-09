import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { cx } from '@/lib/cx';
import { formatDeparture, formatDepartureWindow } from '@/lib/format';
import type { RatingPage, RatingPerson } from '@/lib/ride-ratings';
import { campusPlaceLabel } from '@/lib/ride-status';
import { routes } from '@/lib/routes';
import { RatingForm } from './RatingForm';
import { RideStateLabel } from './RideStateLabel';

type Panel = { label: string; big?: string; note: string };

const countPeople = (count: number) => (count === 1 ? '1 person' : `${count} people`);

/** The forest panel at the top: whether rating is open, until when, and what that means. */
function panelFor(page: RatingPage, closesAt: string, ratedCount: number): Panel {
  const total = page.people.length;
  if (page.window === 'cancelled') {
    return { label: 'This ride was cancelled', note: 'A cancelled ride cannot be rated.' };
  }
  if (page.window === 'not_completed') {
    return {
      label: 'Rating is not open yet',
      big: 'Not completed',
      note: 'Once the owner marks this ride completed, everyone on it can rate each other for 72 hours.',
    };
  }
  if (total === 0) {
    return {
      label: 'Nobody else was on this ride',
      note: 'You were the only person on it, so there is nobody to rate.',
    };
  }
  if (page.window === 'closed') {
    return {
      label: 'Rating closed on',
      big: closesAt,
      note: `You rated ${ratedCount} of ${countPeople(total)}. Rating stays open for 72 hours after the owner marks a ride completed.`,
    };
  }
  if (ratedCount === total) {
    return {
      label: 'You rated everyone on this ride',
      big: `${total} of ${total}`,
      note: `Your ratings count from ${closesAt}, when rating closes for everyone, so nobody can tell who gave which score.`,
    };
  }
  return {
    label: 'Rating is open until',
    big: closesAt,
    note: 'Score each person from 1 to 5. Send some now and the rest later. A rating cannot be changed once sent.',
  };
}

/**
 * The review page (CS455-43, US-RD-28, RO-US-14): the people on a completed
 * ride rate each other for 72 hours. It shows the form while rating is open
 * and someone is left to rate; otherwise it says why not, and whom the viewer
 * rated. RatingPage comes from the server and holds no user IDs.
 */
export function RideReview({ page }: { page: RatingPage }) {
  const placeLabel = campusPlaceLabel(page.direction);
  const toRate = page.people.filter((person) => !person.rated);
  const rated = page.people.filter((person) => person.rated);
  const closesAt = page.closesAt ? formatDeparture(page.closesAt) : '';
  const panel = panelFor(page, closesAt, rated.length);
  const formOpen = page.window === 'open' && toRate.length > 0;
  const showList =
    page.people.length > 0 && (page.window === 'closed' || (page.window === 'open' && !formOpen));

  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <ButtonLink href={routes.ride(page.rideId)} variant="quiet" className="px-0">
        Back to the ride
      </ButtonLink>

      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
          Rate this ride
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{page.title}</h1>
        <p className="mt-4 font-mono text-lg tabular-nums">
          {formatDepartureWindow(page.departureStart, page.departureEnd)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <RideStateLabel state={page.state} />
          <p className="text-sm text-ink-muted">
            {countPeople(page.people.length + 1)} on this ride, you included
          </p>
        </div>
      </header>

      <section
        data-surface="brand"
        aria-label={panel.label}
        className="mt-8 rounded-panel bg-brand p-5 text-on-brand sm:p-6"
      >
        <p className="text-sm font-semibold text-on-brand-muted">{panel.label}</p>
        {panel.big && (
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
            {panel.big}
          </p>
        )}
        <p className="mt-2 text-sm text-on-brand-muted">{panel.note}</p>
      </section>

      {formOpen && (
        <>
          <p className="mt-6 text-ink-muted">
            Nobody sees who gave which score. Others see only an average, from 3 ratings up.
          </p>
          {rated.length > 0 && (
            <PeopleStatus heading="Already rated" people={rated} placeLabel={placeLabel} />
          )}
          <RatingForm
            rideId={page.rideId}
            people={toRate}
            closesAt={closesAt}
            placeLabel={placeLabel}
          />
        </>
      )}

      {showList && (
        <PeopleStatus
          heading="The people you travelled with"
          people={page.people}
          placeLabel={placeLabel}
        />
      )}

      {page.window === 'not_completed' && (
        <p className="mt-6 text-ink-muted">
          {page.viewerRole === 'owner'
            ? 'You can mark the ride completed from the ride page once it has left.'
            : 'The owner can mark the ride completed from the ride page once it has left.'}{' '}
          Rating is open from then until 72 hours later.
        </p>
      )}

      {!formOpen && (
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={routes.ride(page.rideId)}>Back to the ride</ButtonLink>
          <ButtonLink href={routes.home} variant="secondary">
            Your rides
          </ButtonLink>
        </div>
      )}
    </DesignSystem>
  );
}

/** Whom the viewer has rated, by name only: never a score or anything about the others' ratings. */
function PeopleStatus({
  heading,
  people,
  placeLabel,
}: {
  heading: string;
  people: RatingPerson[];
  placeLabel: string;
}) {
  const headingId = heading === 'Already rated' ? 'rated-heading' : 'status-heading';
  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 id={headingId} className="text-xl font-bold tracking-tight">
        {heading}
      </h2>
      <ol className="mt-3 divide-y divide-line border-y border-line">
        {people.map((person) => (
          <li
            key={person.occupantId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
          >
            <div>
              <p className="font-semibold">
                {person.name}{' '}
                <span className="font-normal text-ink-muted">
                  ({person.isOwner ? 'Ride owner' : 'Rider'})
                </span>
              </p>
              <p className="text-sm text-ink-muted">
                {placeLabel}: {person.campusPlace}
              </p>
            </div>
            <p className={cx('text-sm', person.rated ? 'font-bold' : 'text-ink-muted')}>
              {person.rated ? 'Rated' : 'Not rated'}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
