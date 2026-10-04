import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';

export default function NotFound() {
  return (
    <DesignSystem className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Page not found</h1>
      <p className="mt-5 max-w-xl text-lg text-ink-muted">
        There is no page at this address. The link may be wrong, or the page may have moved.
      </p>
      <ButtonLink href="/" className="mt-8">
        Go to the home page
      </ButtonLink>
    </DesignSystem>
  );
}
