import Link from 'next/link';
import { FareSplitCard } from '@/components/landing/FareSplitCard';
import { ThemeToggle } from '@/components/landing/ThemeToggle';
import { Icon } from '@/components/PageShells';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';

const HUBS = [
  'Kanpur Central',
  'Kanpur Anwarganj',
  'Bus station',
  'Metro station',
  'Kanpur airport',
  'Lucknow airport',
];

const STEPS = [
  {
    title: 'Register with your IITK email',
    text: 'Verify your @iitk.ac.in address to join the community.',
  },
  {
    title: 'Find a ride, or offer your own',
    text: 'Search by destination and time, or post your empty seats.',
  },
  {
    title: 'The ride locks',
    text: 'Once the owner locks the ride, the group and the fare are fixed.',
  },
  {
    title: 'Pay the owner and rate the ride',
    text: 'Pay your share in whole rupees, then rate the trip.',
  },
];

const SAFETY = [
  {
    title: 'SOS during a trip',
    text: 'Press SOS to share your live location with your emergency contacts. In an emergency, call 112. SOS does not replace that call.',
  },
  {
    title: 'IITK emails only',
    text: 'Every account is tied to a verified @iitk.ac.in address.',
  },
  {
    title: 'Phone numbers stay private',
    text: 'Your number is shared only with the other people in your ride.',
  },
  {
    title: 'Pickup points on campus',
    text: 'Meet at familiar places such as your hall, the Shopping Centre or Main Gate.',
  },
  {
    title: 'Rate every ride',
    text: 'Ratings after each trip keep the community accountable.',
  },
];

const FARE_POINTS = [
  'Whole-rupee totals with no hidden fee',
  'Clear estimate before a rider joins',
  'Owner and every rider see the same split',
];

function Brand() {
  return (
    <Link className="logo" href="/" aria-label="Campus Ride Pooling home">
      <span className="logo-mark">
        <Icon name="route" size={21} />
      </span>
      <span>
        Campus Ride <span>Pooling</span>
      </span>
    </Link>
  );
}

export default async function LandingPage() {
  const session = await getSession();
  const primary = session
    ? { href: '/home', label: 'Go to your rides' }
    : { href: '/register', label: 'Register' };

  return (
    <div className="landing">
      <header className="nav shell">
        <Brand />
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#destinations">Destinations</a>
          <a href="#safety">Safety</a>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          {!session && (
            <Link className="text-button" href="/login">
              Sign in
            </Link>
          )}
          <Link className="button button-sm" href={primary.href}>
            {primary.label} <Icon name="arrow" size={17} />
          </Link>
          {session && (
            <Link className="button button-sm button-light" href={routes.profile} title="Profile">
              <Icon name="user" size={17} /> Profile
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <div className="eyebrow">
              <span>
                <Icon name="spark" size={15} />
              </span>
              Built for the IITK community
            </div>
            <h1>
              Share the ride. <em>Split the fare.</em>
            </h1>
            {session ? (
              <p>Find a ride or offer one from your home page.</p>
            ) : (
              <p>
                The trusted carpool network for IIT Kanpur. Find your people, split the fare, and
                make every trip beyond campus better.
              </p>
            )}
            <div className="hero-actions">
              <Link className="button button-lg" href={primary.href}>
                {primary.label} <Icon name="arrow" size={19} />
              </Link>
              <a className="play-link" href="#how-it-works">
                <span className="play">
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 1l7 4-7 4z" fill="currentColor" />
                  </svg>
                </span>
                See how it works
              </a>
            </div>
            <div className="course-project">
              <span>
                <Icon name="shield" size={17} />
              </span>
              <div>
                <strong>CS455 · Software Engineering</strong>
                <small>A course project at IIT Kanpur</small>
              </div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Featured upcoming ride">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-note note-top">
              <span className="note-icon">
                <Icon name="shield" size={18} />
              </span>
              <span>
                <b>IITK verified</b>
                <small>Safe campus community</small>
              </span>
            </div>
            <div className="ride-card">
              <div className="ride-card-head">
                <div>
                  <span className="card-kicker">Next ride</span>
                  <h3>Leaving campus</h3>
                </div>
                <span className="available">3 seats</span>
              </div>
              <div className="route">
                <div className="route-dots">
                  <span />
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
                <div className="route-details">
                  <div>
                    <strong>IIT Kanpur</strong>
                    <span>Hall 3 parking</span>
                  </div>
                  <div>
                    <strong>Lucknow Airport</strong>
                    <span>Terminal 3</span>
                  </div>
                </div>
              </div>
              <div className="trip-meta">
                <span>
                  <Icon name="calendar" size={17} /> Sat, 24 Aug
                </span>
                <span>
                  <Icon name="clock" size={17} /> 6:30 AM
                </span>
              </div>
              <div className="driver">
                <div className="driver-avatar">AV</div>
                <div>
                  <strong>Arjun Verma</strong>
                  <span>Y22 · Computer Science</span>
                </div>
                <div className="price">
                  <strong>₹320</strong>
                  <span>/ seat</span>
                </div>
              </div>
              <span className="card-button">
                View ride details <Icon name="chevron" size={17} />
              </span>
            </div>
            <div className="floating-note note-bottom">
              <span className="tiny-avatars">
                <i>MP</i>
                <i>RS</i>
              </span>
              <span>
                <b>2 joined</b>
                <small>Going your way</small>
              </span>
            </div>
          </div>
        </section>

        <section className="block shell" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <span className="section-label">SIMPLE BY DESIGN</span>
            <h2 id="how-title">How a ride works</h2>
            <p>Less planning, more going. Four steps from sign-up to arrival.</p>
          </div>
          <ol className="step-list">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="fs-demo shell">
          <div className="fs-copy">
            <span className="section-label">FAIR FARES, NO AWKWARD MATH</span>
            <h2>
              Split the journey. <em>Not the friendship.</em>
            </h2>
            <p>
              Enter the trip total and number of people. We split every rupee transparently, with
              any remainder assigned in a predictable order.
            </p>
            <ul>
              {FARE_POINTS.map((point) => (
                <li key={point}>
                  <Icon name="check" size={16} /> {point}
                </li>
              ))}
            </ul>
          </div>

          <section className="fs-card" aria-labelledby="fare-title">
            <div className="fs-top">
              <div>
                <span className="fs-kicker">LIVE EXAMPLE</span>
                <h3 id="fare-title">Try the fare split</h3>
              </div>
              <span className="fs-pill">Example ride</span>
            </div>
            <p className="sr-only">From Hall 6 to Kanpur Central, shared by three people.</p>
            <div className="fs-trip" aria-hidden="true">
              <div className="fs-line">
                <span />
                <i />
                <b />
              </div>
              <div className="fs-stops">
                <div>
                  <strong>Hall 6</strong>
                  <small>IITK pickup</small>
                </div>
                <div>
                  <strong>Kanpur Central</strong>
                  <small>Railway station</small>
                </div>
              </div>
              <div className="fs-time">
                <span>Saturday</span>
                <strong>06:40 AM</strong>
              </div>
            </div>
            <div className="fs-inner">
              <FareSplitCard />
            </div>
          </section>
        </div>

        <section className="block shell" id="destinations" aria-labelledby="hubs-title">
          <div className="section-heading">
            <span className="section-label">DESTINATIONS</span>
            <h2 id="hubs-title">From your hall to the station or airport</h2>
            <p>Rides run between any of the fourteen halls or Main Gate and these hubs.</p>
          </div>
          <ul className="hub-list">
            {HUBS.map((hub) => (
              <li key={hub}>{hub}</li>
            ))}
          </ul>
        </section>

        <section className="block shell" id="safety" aria-labelledby="safety-title">
          <div className="section-heading">
            <span className="section-label">SAFETY</span>
            <h2 id="safety-title">Safety and privacy</h2>
          </div>
          <div className="feature-grid">
            {SAFETY.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {!session && (
          <section className="cta shell">
            <div className="cta-copy">
              <span className="section-label">YOUR NEXT TRIP STARTS HERE</span>
              <h2>
                Going somewhere?
                <br />
                <em>Don&apos;t go alone.</em>
              </h2>
              <p>
                Find a ride or offer your empty seats to someone from IITK heading the same way.
              </p>
            </div>
            <div className="cta-action">
              <div className="cta-route-art" aria-hidden="true">
                <span className="cta-point">
                  <Icon name="pin" size={16} />
                </span>
                <span className="cta-track">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="cta-car">
                  <Icon name="car" size={21} />
                </span>
              </div>
              <Link className="button button-light button-lg" href="/register">
                Join Campus Ride Pooling <Icon name="arrow" size={19} />
              </Link>
            </div>
          </section>
        )}
      </main>

      <footer className="footer shell">
        <Brand />
        <p>A CS455 Software Engineering course project at IIT Kanpur.</p>
        <div>
          <a href="#safety">Safety</a>
          <a href="mailto:campusridepooling@iitk.ac.in">Contact</a>
        </div>
      </footer>
    </div>
  );
}
