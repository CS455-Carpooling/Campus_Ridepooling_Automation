import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { routes } from '@/lib/routes';

/**
 * The same answer for a wrong link, a ride that does not exist and a ride the
 * viewer may not see, so the page never reveals whether a ride exists.
 */
export default function RideNotFound() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Ride not found</h1>
      <p className="mt-5 max-w-xl text-lg text-ink-muted">
        The link may be wrong, or the ride is not open to you. The people on a ride can always see
        it; others can see it only until it locks, an hour before departure.
      </p>
      <ButtonLink href={routes.home} className="mt-8">
        Go to your rides
      </ButtonLink>
    </DesignSystem>
  );
}
