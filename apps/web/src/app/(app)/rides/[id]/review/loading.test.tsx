import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RideReviewLoading from './loading';

describe('RideReviewLoading', () => {
  it('shows skeletons and announces that the review page is loading', () => {
    const { container } = render(<RideReviewLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the review page');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(5);
  });
});
