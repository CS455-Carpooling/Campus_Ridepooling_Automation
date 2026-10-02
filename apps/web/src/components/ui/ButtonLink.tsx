import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cx } from '@/lib/cx';
import { buttonClassName, type ButtonVariant } from './Button';

export type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
};

/** A link that looks like a button, for actions that open another page. */
export function ButtonLink({ variant = 'primary', className, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName(variant, cx(variant !== 'quiet' && 'no-underline', className))}
      {...props}
    />
  );
}
