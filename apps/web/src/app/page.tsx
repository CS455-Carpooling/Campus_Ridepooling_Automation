import { FareCard } from '@/components/landing/FareCard';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';

const container = 'mx-auto max-w-6xl px-4 sm:px-6';

type Hub = { name: string; detail?: string };

// The initial destination hubs (SYS-FR-09). Operations admins can change the
// hubs later, but the landing page describes the service as launched.
const groundHubs: Hub[] = [
  { name: 'Kanpur Central', detail: 'Railway station' },
  { name: 'Kanpur Anwarganj', detail: 'Railway station' },
  { name: 'Bus station' },
  { name: 'Metro station' },
];
const airportHubs: Hub[] = [{ name: 'Kanpur airport' }, { name: 'Lucknow airport' }];

// D1 rider requirements: FR-RD-01 and 02.4 (registration, public profile),
// FR-RD-03 and 06 (search and requests), P-06, FR-RD-08.3 and 09.1 (lock time,
// fixed shares, pool chat), FR-RD-11.2 and 12 (payment, ratings).
const steps = [
  {
    when: 'Once',
    title: 'Register with your IITK email',
    body: 'Only @iitk.ac.in addresses can sign up, so everyone you ride with has an IIT Kanpur account.',
  },
  {
    when: 'Before you travel',
    title: 'Find a ride, or offer your own',
    body: 'Search by destination and time and ask for a seat, or post the ride you are taking and choose who joins.',
  },
  {
    when: 'An hour before departure',
    title: 'The ride locks',
    body: 'Who is travelling and what each person pays are fixed, and a chat opens for the group to plan the pickup.',
  },
  {
    when: 'After the trip',
    title: 'Pay the owner and rate the ride',
    body: 'Pay your share by UPI or cash, mark it paid in the app, and rate the people you travelled with.',
  },
];

// FR-RD-02.4 and 02.7, FR-RD-13.3, FR-RD-09.5 (P-15) and FR-RD-11.2.
const safetyFacts = [
  {
    title: 'Contact details stay private',
    body: 'Other students see your display name and rating, never your email address. Only the operations team sees your phone number.',
  },
  {
    title: 'Complaints are confidential',
    body: 'The person you report never sees who complained or what you wrote.',
  },
  {
    title: 'Chats do not stay forever',
    body: 'A ride chat becomes read-only a day after the trip and is deleted 30 days later, unless a complaint needs it.',
  },
  {
    title: 'Money goes to the owner',
    body: 'You pay the ride owner directly. The app records that you paid and never holds your money.',
  },
];

/** Landing page: what the service does, a live fare split, where rides go, and how to start. */
export default async function LandingPage() {
  const signedIn = (await getSession()) !== null;

  return (
    <>
      <Hero signedIn={signedIn} />
      <Destinations />
      <HowItWorks />
      <Safety />
      <GetStarted signedIn={signedIn} />
    </>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className={cx(
        container,
        'grid gap-12 pt-12 pb-16 md:pt-16 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-20 lg:pb-24',
      )}
    >
      <div className="lg:col-span-7">
        <p className="text-xs font-bold tracking-[0.18em] text-accent-text uppercase">
          Only for IIT Kanpur
        </p>
        <h1
          id="hero-heading"
          className="mt-5 text-4xl leading-none font-extrabold tracking-tighter sm:text-6xl lg:text-7xl"
        >
          <span className="block">Share the ride.</span>{' '}
          <span className="block text-accent-text">Split the fare.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
          Find students leaving campus when you are, ride together, and pay an equal share of the
          fare.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {signedIn ? (
            <ButtonLink href={routes.home}>Go to your rides</ButtonLink>
          ) : (
            <>
              <ButtonLink href={routes.register}>Register</ButtonLink>
              <ButtonLink href={routes.login} variant="secondary">
                Sign in
              </ButtonLink>
            </>
          )}
        </div>
      </div>
      <div className="lg:col-span-5">
        <FareCard />
      </div>
    </section>
  );
}

type HubGroupProps = { title: string; hubs: Hub[]; twoColumns?: boolean; className: string };

function HubGroup({ title, hubs, twoColumns = false, className }: HubGroupProps) {
  return (
    <div className={cx('rounded-panel p-6 sm:p-8', className)}>
      <h3 className="text-sm font-bold text-ink-muted">{title}</h3>
      <ul className={cx('mt-6 grid gap-x-8 gap-y-6', twoColumns && 'sm:grid-cols-2')}>
        {hubs.map((hub) => (
          <li key={hub.name}>
            <span className="block text-2xl font-bold tracking-tight">{hub.name}</span>
            {hub.detail && <span className="text-ink-muted">{hub.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Destinations() {
  return (
    <section aria-labelledby="destinations-heading" className={cx(container, 'py-16 md:py-24')}>
      <h2
        id="destinations-heading"
        className="max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl"
      >
        From your hall to the station or airport
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        Rides start at any of the fourteen halls or Main Gate and go to these places.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-5">
        <HubGroup
          title="Trains, buses and the metro"
          hubs={groundHubs}
          twoColumns
          className="bg-panel md:col-span-3"
        />
        <HubGroup
          title="Flights"
          hubs={airportHubs}
          className="border border-line-strong md:col-span-2"
        />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-y border-line bg-surface">
      <div className={cx(container, 'grid gap-12 py-16 md:py-24 lg:grid-cols-12')}>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-10">
            <h2 id="how-heading" className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              How a ride works
            </h2>
            <p className="mt-5 text-lg text-ink-muted">From registering to paying your share.</p>
          </div>
        </div>
        <ol className="lg:col-span-8">
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            return (
              <li key={step.title} className="grid grid-cols-[auto_1fr] gap-x-5 sm:gap-x-8">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-paper font-mono text-sm font-medium"
                  >
                    {index + 1}
                  </span>
                  {!last && <span aria-hidden="true" className="w-px flex-1 bg-line-strong" />}
                </div>
                <div className={cx('pt-2', !last && 'pb-12')}>
                  <p className="font-mono text-sm text-accent-text">{step.when}</p>
                  <h3 className="mt-1 text-2xl font-bold tracking-tight">{step.title}</h3>
                  <p className="mt-3 max-w-xl text-ink-muted">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Safety() {
  return (
    <section aria-labelledby="safety-heading" className={cx(container, 'py-16 md:py-24')}>
      <h2 id="safety-heading" className="text-3xl font-extrabold tracking-tight sm:text-5xl">
        Safety and privacy
      </h2>
      <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {/* FR-RD-15.1 to 15.4. */}
        <div className="rounded-panel bg-panel p-6 sm:p-8 md:col-span-2 md:grid md:grid-cols-2 md:gap-12">
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">SOS during a trip</h3>
          <div className="mt-3 md:mt-0">
            <p className="text-lg text-ink-muted">
              While your pickup or trip is in progress, the SOS button alerts the operations team.
              The other people in the ride are not told.
            </p>
            <p className="mt-4 text-lg font-semibold">
              The app does not call emergency services. In an emergency, call 112.
            </p>
          </div>
        </div>
        {safetyFacts.map((fact) => (
          <div key={fact.title} className="border-t border-line-strong pt-6">
            <h3 className="text-xl font-bold tracking-tight">{fact.title}</h3>
            <p className="mt-2 max-w-md text-ink-muted">{fact.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GetStarted({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="start-heading" className={cx(container, 'pb-16 md:pb-24')}>
      <div
        data-surface="brand"
        className="flex flex-col gap-8 rounded-panel bg-brand p-8 text-on-brand sm:p-12 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h2 id="start-heading" className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Leaving campus soon?
          </h2>
          <p className="mt-4 max-w-xl text-lg text-on-brand-muted">
            {signedIn
              ? 'Find a ride or offer one from your home page.'
              : 'Register with your IITK email to find people going your way.'}
          </p>
        </div>
        <ButtonLink
          href={signedIn ? routes.home : routes.register}
          variant="accent"
          className="self-start md:self-auto"
        >
          {signedIn ? 'Go to your rides' : 'Register'}
        </ButtonLink>
      </div>
    </section>
  );
}
