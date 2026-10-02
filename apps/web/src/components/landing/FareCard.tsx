import { FareCalculator } from './FareCalculator';

/**
 * The landing page's product demonstration: an example ride on a forest panel,
 * with the live fare split underneath. The ride is labelled as an example; the
 * calculator runs the same splitFare() the app uses.
 */
export function FareCard() {
  return (
    <section
      aria-labelledby="fare-card-heading"
      data-surface="brand"
      className="rounded-panel bg-brand p-5 text-on-brand sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="fare-card-heading" className="text-xl font-bold tracking-tight">
          Try the fare split
        </h2>
        <p className="text-sm text-on-brand-muted">Example ride</p>
      </div>

      <p className="sr-only">
        From Hall 6 to Kanpur Central railway station, leaving on Saturday at 06:40.
      </p>
      <div aria-hidden="true" className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-3">
        <span className="size-3 rounded-full bg-accent" />
        <p>
          <span className="font-semibold">Hall 6</span>{' '}
          <span className="text-sm text-on-brand-muted">pickup</span>
        </p>
        <span className="mx-auto h-5 w-0 border-l border-dashed border-on-brand-muted" />
        <span />
        <span className="size-3 rounded-full border-2 border-accent" />
        <p>
          <span className="font-semibold">Kanpur Central</span>{' '}
          <span className="text-sm text-on-brand-muted">railway station</span>
        </p>
      </div>
      <p aria-hidden="true" className="mt-4 font-mono text-sm text-on-brand-muted">
        Saturday, 06:40
      </p>

      <div data-surface="light" className="mt-6 rounded-control bg-surface p-4 text-ink sm:p-5">
        <FareCalculator />
      </div>
    </section>
  );
}
