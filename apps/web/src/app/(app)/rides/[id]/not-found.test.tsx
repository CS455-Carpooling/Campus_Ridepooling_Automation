import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RideNotFound from './not-found';

describe('RideNotFound', () => {
  it('gives one answer for any ride it cannot show, and links to your dashboard', () => {
    render(<RideNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ride not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your rides' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
