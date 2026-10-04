import { routes } from '@/lib/routes';
import Link from 'next/link';
import { DesignSystem } from '@/components/ui/DesignSystem';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent-text">Legal</p>
      <h1 className="mb-8 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
        Privacy Policy
      </h1>

      <div className="prose prose-ink max-w-none space-y-6 text-ink-muted">
        <p className="text-lg">
          At Campus Ride-Pooling, we take your privacy seriously. This policy explains what
          information we collect, how we use it, and how we protect your data.
        </p>

        <h2 className="mt-12 text-2xl font-bold text-ink">1. Information We Collect</h2>
        <p>
          We collect your name, roll number, and <code>@iitk.ac.in</code> email address when you
          register. When you offer or join a ride, we collect the trip details (starting point,
          destination, time) and chat messages associated with that ride.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">2. How We Use Your Data</h2>
        <p>
          Your data is used solely to facilitate ride-sharing within the IIT Kanpur community. We
          use your email to verify your identity and your trip data to match you with co-passengers.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">3. Data Retention</h2>
        <p>
          Ride chats become read-only a day after the trip and are automatically deleted 30 days
          later, unless a complaint requires them to be retained for review. We do not keep your
          location history beyond what is necessary to complete the ride.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">4. Third-Party Sharing</h2>
        <p>
          We do not sell, rent, or share your personal information with third parties. Your data
          stays strictly within the Campus Ride-Pooling system for the IITK community.
        </p>

        <div className="mt-12 rounded-panel border border-line bg-panel p-6">
          <p className="text-sm">
            <em>
              This is a placeholder page for the Privacy Policy. The final legal terms will be
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
