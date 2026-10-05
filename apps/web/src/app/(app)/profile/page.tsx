import { verifySession } from '@/lib/session';
import { DesignSystem } from '@/components/ui/DesignSystem';

export const metadata = { title: 'Your Profile' };

export default async function ProfilePage() {
  const session = await verifySession();

  return (
    <DesignSystem className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Profile</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="flex flex-col items-center rounded-panel border border-line bg-panel p-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-3xl font-bold text-on-brand">
              {session.displayName.charAt(0).toUpperCase()}
            </div>
            <h2 className="mt-4 text-xl font-bold text-ink">{session.displayName}</h2>
            <p className="mt-1 text-sm text-ink-muted">{session.email}</p>
            <p className="mt-3 inline-flex items-center rounded-control border border-line bg-surface px-3 py-1 text-xs font-semibold capitalize text-ink">
              {session.role} Account
            </p>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-8">
          <section aria-labelledby="experiences-heading">
            <h3 id="experiences-heading" className="text-xl font-bold tracking-tight text-ink">
              Experiences & Ratings
            </h3>
            <div className="mt-4 rounded-panel border border-line bg-surface p-6">
              <p className="text-ink-muted">
                No experiences recorded yet. Complete a ride to receive ratings and feedback from
                your peers.
              </p>
            </div>
          </section>

          <section aria-labelledby="past-rides-heading">
            <h3 id="past-rides-heading" className="text-xl font-bold tracking-tight text-ink">
              Past Rides
            </h3>
            <div className="mt-4 rounded-panel border border-line bg-surface p-6">
              <p className="text-ink-muted">You haven&apos;t completed any rides yet.</p>
            </div>
          </section>

          <section aria-labelledby="account-settings-heading">
            <h3 id="account-settings-heading" className="text-xl font-bold tracking-tight text-ink">
              Account Settings
            </h3>
            <div className="mt-4 rounded-panel border border-line bg-surface p-6">
              <p className="text-sm text-ink-muted">
                Preferences and account management options will appear here.
              </p>
            </div>
          </section>
        </div>
      </div>
    </DesignSystem>
  );
}
