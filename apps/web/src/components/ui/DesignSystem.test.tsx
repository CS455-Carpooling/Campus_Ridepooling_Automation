import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_FONTS, DesignSystem } from './DesignSystem';

describe('DesignSystem', () => {
  it('scopes the design-system tokens to its content', () => {
    render(
      <DesignSystem className="mx-auto max-w-3xl">
        <p>Inside the design system</p>
      </DesignSystem>,
    );
    expect(screen.getByText('Inside the design system').parentElement).toHaveClass(
      'ds',
      'mx-auto',
      'max-w-3xl',
    );
  });

  it('works without extra classes', () => {
    render(
      <DesignSystem>
        <p>Plain</p>
      </DesignSystem>,
    );
    expect(screen.getByText('Plain').parentElement).toHaveClass('ds');
  });

  it('loads its fonts from Google Fonts, which the Content-Security-Policy allows', () => {
    render(
      <DesignSystem>
        <p>Fonts</p>
      </DesignSystem>,
    );
    const url = new URL(DESIGN_SYSTEM_FONTS);
    expect(url.origin).toBe('https://fonts.googleapis.com');
    expect(url.searchParams.getAll('family')).toEqual([
      'IBM Plex Mono:wght@400;500',
      'Manrope:wght@400..800',
    ]);
    const links = document.querySelectorAll(
      `link[rel="stylesheet"][href="${DESIGN_SYSTEM_FONTS}"]`,
    );
    expect(links).toHaveLength(1);
  });
});
