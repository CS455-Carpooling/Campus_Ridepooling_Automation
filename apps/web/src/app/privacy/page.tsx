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
          register. Your profile may also store a display name, default pickup point, optional
          mobile number, interest tags and ride preferences. When you offer or join a ride, we
          collect the trip details (starting point, destination, time) and chat messages associated
          with that ride.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">2. How We Use Your Data</h2>
        <p>
          Your data is used to facilitate ride-sharing within the IIT Kanpur community. We use your
          email to verify your identity and your trip data to match you with co-passengers. On ride
          pages, other riders may see your display name, tags you mark visible, and completed-trip
          count. Your email and mobile number are not shown to other riders or ride owners.
        </p>

        <p>
          Mobile numbers are optional, are not shown to other riders, and are never sent to AI
          services. The administrator-only SOS access flow is not currently implemented. Interest
          tags are not used for AI suggestions or ranking unless you explicitly opt in from your
          profile. You can withdraw that consent at any time. The AI suggestion service is not
          currently available.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">3. Data Retention</h2>
        <p>
          Ride chats become read-only a day after the trip and are automatically deleted 30 days
          later, unless a complaint requires them to be retained for review. We do not keep your
          location history beyond what is necessary to complete the ride.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">4. Third-Party Sharing</h2>
        <p>
          We do not sell or rent your personal information. If AI suggestions are enabled in the
          future, only selected interest tags may be shared with the AI service when you have
          consented; email addresses, mobile numbers, and chat or complaint text are excluded.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">5. Your Data Controls</h2>
        <p>
          From your profile, you can download a JSON copy of your account, profile, and ride data,
          or delete your account. Deletion removes your sign-in and profile data and anonymizes your
          name on retained ride history. You may reset your password from the account settings.
        </p>

        <div className="mt-12 rounded-panel border border-line bg-panel p-6">
          <p className="text-sm">
            <em>
              This policy describes the current prototype and should be reviewed before launch.
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
