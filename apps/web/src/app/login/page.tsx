import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { routes } from '@/lib/routes';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="mx-auto my-8 flex w-full max-w-5xl flex-col overflow-hidden rounded-panel border border-line md:my-16 md:flex-row">
      <div
        className="relative flex w-full flex-col justify-between overflow-hidden bg-brand p-8 text-on-brand md:w-5/12 md:p-10 lg:p-12"
        data-surface="brand"
      >
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-control border border-line bg-panel px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Only at IIT Kanpur
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-on-brand sm:text-4xl">
            “Some of the best campus stories begin with a shared ride.”
          </h1>
        </div>

        <div className="mt-12 hidden md:block">
          <div className="flex items-center gap-4 rounded-panel border border-line bg-panel p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-brand">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-on-brand">IIT Kanpur</span>
              <span className="text-xs text-on-brand-muted">Starting point</span>
            </div>
            <div className="flex-1 border-t border-dashed border-line"></div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-panel text-on-brand">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          <div className="mt-8 flex gap-4 text-xs font-semibold text-on-brand-muted">
            <span>Verified</span>
            <span>•</span>
            <span>Safer rides</span>
            <span>•</span>
            <span>Better journeys</span>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center bg-paper p-8 md:w-7/12 md:p-12 lg:p-16">
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent-text">
            Welcome back
          </p>
          <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Ready for your next trip?
          </h2>
          <p className="mb-8 text-base text-ink-muted">
            Sign in to find rides, manage bookings, and see where your friends are headed.
          </p>

          <form className="flex flex-col gap-5">
            <Field
              label="IITK email address"
              type="email"
              placeholder="username@iitk.ac.in"
              autoComplete="username"
            />
            <Field
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="current-password"
            />

            <div className="mt-1 flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-control border-line-strong text-accent accent-accent focus:ring-accent"
                />
                Keep me signed in
              </label>
              <Link
                href="/reset-password"
                className="font-semibold text-accent-text hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="mt-2 w-full justify-between">
              Log in to Campus Ride-Pooling
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-muted">
            New to Campus Ride-Pooling?{' '}
            <Link href={routes.register} className="font-bold text-accent-text hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-ink-muted">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            Secured with IITK email verification
          </div>
        </div>
      </div>
    </div>
  );
}
