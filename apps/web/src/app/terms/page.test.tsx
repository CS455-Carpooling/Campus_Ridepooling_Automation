import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { routes } from '@/lib/routes';
import TermsPage, { metadata } from './page';

describe('TermsPage', () => {
  it('has the page title as metadata and as the only h1', () => {
    render(<TermsPage />);
    expect(metadata.title).toBe('Community Guidelines');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Community Guidelines' })).toBeInTheDocument();
  });

  it('is marked as a placeholder and links back to registration', () => {
    render(<TermsPage />);
    expect(screen.getByText(/placeholder page/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Registration/ })).toHaveAttribute(
      'href',
      routes.register,
    );
  });
});
