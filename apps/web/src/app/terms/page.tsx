import { routes } from '@/lib/routes';
import Link from 'next/link';
import { DesignSystem } from '@/components/ui/DesignSystem';

export const metadata = { title: 'Community Guidelines' };

export default function TermsPage() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent-text">Legal</p>
      <h1 className="mb-8 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
        Community Guidelines
      </h1>

      <div className="prose prose-ink max-w-none space-y-6 text-ink-muted">
        <p className="text-lg">
          Welcome to Campus Ride-Pooling. These community guidelines ensure that every journey
          shared between IIT Kanpur students is safe, respectful, and reliable.
        </p>

        <h2 className="mt-12 text-2xl font-bold text-ink">1. Eligibility</h2>
        <p>
          You must be a current student or affiliate of IIT Kanpur with a valid{' '}
          <code>@iitk.ac.in</code> email address. Your account is strictly personal and cannot be
          shared.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">2. Safety First</h2>
        <p>
          Safety is our top priority. We expect all riders and ride owners to follow standard road
          safety laws. If you ever feel unsafe during a trip, use the in-app SOS feature. (Note:
          This app does not call emergency services. In a true emergency, call 112).
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">3. Fare Splits</h2>
        <p>
          Fares are strictly split among the vehicle occupants as calculated by the app. Ride owners
          should not ask for more than the split calculated, and riders should ensure they pay the
          owner promptly upon completing the journey.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">4. Respect and Privacy</h2>
        <p>
          Treat your fellow passengers with respect. Any form of harassment, discrimination, or
          inappropriate behavior will result in an immediate and permanent ban. Respect the privacy
          of others and do not share their contact details.
        </p>

        <div className="mt-12 rounded-panel border border-line bg-panel p-6">
          <p className="text-sm">
            <em>
              This is a placeholder page for the Community Guidelines. The final legal terms will be
              updated prior to production launch.
            </em>
          </p>
        </div>

        <div className="mt-12">
          <Link href={routes.register} className="font-semibold text-accent-text hover:underline">
            &larr; Back to Registration
          </Link>
        </div>
      </div>
    </DesignSystem>
  );
}
