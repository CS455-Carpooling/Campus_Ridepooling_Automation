import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RideLoading from './loading';

describe('RideLoading', () => {
  it('shows skeletons and announces that the ride is loading', () => {
    const { container } = render(<RideLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the ride');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(5);
  });
});
