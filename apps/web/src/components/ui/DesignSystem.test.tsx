import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystem } from './DesignSystem';

describe('DesignSystem', () => {
  it('scopes the design-system tokens and fonts to its content', () => {
    render(
      <DesignSystem className="mx-auto max-w-3xl">
        <p>Inside the design system</p>
      </DesignSystem>,
    );
    const scope = screen.getByText('Inside the design system').parentElement;
    expect(scope).toHaveClass('ds', 'mx-auto', 'max-w-3xl');
    // The font variables come from next/font (stubbed in test/setup.ts).
    expect(scope?.className).toContain('--font-ds-sans');
    expect(scope?.className).toContain('--font-ds-mono');
  });

  it('works without extra classes', () => {
    render(
      <DesignSystem>
        <p>Plain</p>
      </DesignSystem>,
    );
    expect(screen.getByText('Plain').parentElement).toHaveClass('ds');
  });
});
