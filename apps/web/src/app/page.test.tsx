import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home (placeholder)', () => {
  it('shows the product name as the only top-level heading', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Campus Ride-Pooling' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
