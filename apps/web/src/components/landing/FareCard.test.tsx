import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FareCard } from './FareCard';

describe('FareCard', () => {
  it('is a labelled region that says it is an example ride', () => {
    render(<FareCard />);
    const card = screen.getByRole('region', { name: 'Try the fare split' });
    expect(within(card).getByText('Example ride')).toBeInTheDocument();
  });

  it('describes the route for screen readers', () => {
    render(<FareCard />);
    expect(screen.getByText(/From Hall 6 to Kanpur Central railway station/)).toBeInTheDocument();
  });

  it('contains the live fare calculator', () => {
    render(<FareCard />);
    expect(screen.getByRole('form', { name: 'Fare split' })).toBeInTheDocument();
  });
});
