import type { ComponentProps } from 'react';
import { cx } from '@/lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

// Hover changes colour instantly; no transitions or movement (see the design rules).
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-on-accent hover:border-accent-strong hover:bg-accent-strong',
  secondary: 'border-line-strong bg-transparent text-ink hover:bg-panel',
  quiet:
    'border-transparent bg-transparent text-ink underline underline-offset-4 hover:text-accent',
};

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
};

/** Classes for a button-styled control; shared by Button and ButtonLink. */
export function buttonClassName(variant: ButtonVariant, className?: string): string {
  return cx(
    'inline-flex min-h-11 items-center justify-center rounded-sm border px-4 text-base font-medium',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variantClasses[variant],
    className,
  );
}

/**
 * Button with a 44 px minimum height (NFR-RO-USE-01). Defaults to type="button"
 * so it never submits a form by accident.
 */
export function Button({ variant = 'primary', type = 'button', className, ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, className)} {...props} />;
}
