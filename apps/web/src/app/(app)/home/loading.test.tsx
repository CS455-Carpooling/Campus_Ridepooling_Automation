import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomeLoading from './loading';

describe('HomeLoading', () => {
  it('shows skeletons and announces that the home page is loading', () => {
    const { container } = render(<HomeLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your home page');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(3);
  });
});
