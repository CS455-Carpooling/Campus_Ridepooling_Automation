import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { routes } from '@/lib/routes';

/**
 * What an admin page shows to a signed-in student instead of its content (SYS-FR-39, 43).
 * The page checks on the server, so nothing of the admin data reaches the browser.
 */
export function AdminNotAllowed() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
        Operations admin
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        This page is for operations admins
      </h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Your account does not have admin access. Admin access is given by the team that runs the
        service, never from inside the app.
      </p>
      <ButtonLink href={routes.home} className="mt-8">
        Go to your rides
      </ButtonLink>
    </DesignSystem>
  );
}
