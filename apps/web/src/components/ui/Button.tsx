import type { ComponentProps } from 'react';
import { cx } from '@/lib/cx';

/**
 * primary: the main action on a page. secondary: a second, less important
 * action. accent: the main action on a brand (forest) panel. quiet: an
 * underlined text action.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'quiet';

// Hover changes colour instantly; no transitions or hover movement (see the design rules).
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-primary bg-primary text-on-primary hover:border-primary-strong hover:bg-primary-strong',
  secondary: 'border-line-strong bg-transparent text-ink hover:bg-panel',
  accent:
    'border-accent bg-accent text-on-accent hover:border-accent-strong hover:bg-accent-strong',
  quiet:
    'border-transparent bg-transparent text-ink underline underline-offset-4 hover:text-accent-text',
};

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
};

/** Classes for a button-styled control; shared by Button and ButtonLink. */
export function buttonClassName(variant: ButtonVariant, className?: string): string {
  return cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-5',
    'text-base font-semibold whitespace-nowrap active:translate-y-px',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0',
    variantClasses[variant],
    className,
  );
}

/**
 * Button with a 44 px minimum height (NFR-RO-USE-01). Defaults to type="button"
 * so it never submits a form by accident. Pressing it nudges it down by 1 px.
 */
export function Button({ variant = 'primary', type = 'button', className, ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, className)} {...props} />;
}
