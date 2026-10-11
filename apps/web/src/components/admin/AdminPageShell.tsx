import type { ReactNode } from 'react';
import { NavLinks } from '@/components/shell/NavLinks';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { cx } from '@/lib/cx';
import { navigationFor } from '@/lib/routes';

export type AdminPageShellProps = {
  title: string;
  /** A short line above the title, such as the kind of record shown. */
  eyebrow?: string;
  description?: ReactNode;
  /** The page one level up, as a link above the title. */
  back?: { href: string; label: string };
  /** Buttons that act on the whole page, beside the title. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * The frame of every operations admin page (CS455-49): the admin navigation with the current
 * page marked, logging out, then the page's title and content. It only displays: each page
 * checks access itself with requireAdminPage() before rendering it.
 */
export function AdminPageShell({
  title,
  eyebrow,
  description,
  back,
  actions,
  children,
}: AdminPageShellProps) {
  return (
    <DesignSystem className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
        <nav aria-label="Operations admin">
          <NavLinks items={navigationFor('admin')} />
        </nav>
        <LogoutButton />
      </div>

      <main>
        {back && (
          <ButtonLink href={back.href} variant="quiet" className="mt-6 px-0">
            {back.label}
          </ButtonLink>
        )}
        <header
          className={cx('flex flex-wrap items-end justify-between gap-4', back ? 'mt-4' : 'mt-8')}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
                {eyebrow}
              </p>
            )}
            <h1
              className={cx(
                'text-3xl font-extrabold tracking-tight sm:text-4xl',
                eyebrow && 'mt-2',
              )}
            >
              {title}
            </h1>
            {description && <p className="mt-3 max-w-2xl text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </header>
        <div className="mt-8">{children}</div>
      </main>
    </DesignSystem>
  );
}
