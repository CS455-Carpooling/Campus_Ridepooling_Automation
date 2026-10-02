import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ButtonLink } from './ButtonLink';

describe('ButtonLink', () => {
  it('is a link styled as the primary button by default', () => {
    render(<ButtonLink href="/rides">Find a ride</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Find a ride' });
    expect(link).toHaveAttribute('href', '/rides');
    expect(link).toHaveClass('bg-primary', 'min-h-11', 'no-underline');
  });

  it('supports the secondary variant and extra classes', () => {
    render(
      <ButtonLink href="/rides/new" variant="secondary" className="w-full">
        Offer a ride
      </ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Offer a ride' })).toHaveClass(
      'border-line-strong',
      'w-full',
    );
  });

  it('keeps the underline for the quiet variant', () => {
    render(
      <ButtonLink href="/home" variant="quiet">
        Back
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Back' });
    expect(link).toHaveClass('underline');
    expect(link).not.toHaveClass('no-underline');
  });
});
