import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingRegion, Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is hidden from assistive technology and keeps size classes', () => {
    const { container } = render(<Skeleton className="h-6 w-40" />);
    const block = container.firstElementChild;
    expect(block).toHaveAttribute('aria-hidden', 'true');
    expect(block).toHaveClass('animate-skeleton', 'h-6', 'w-40');
  });
});

describe('LoadingRegion', () => {
  it('announces loading once for the skeletons it contains', () => {
    render(
      <LoadingRegion>
        <Skeleton className="h-6" />
        <Skeleton className="h-6" />
      </LoadingRegion>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Loading');
  });

  it('accepts a more specific label', () => {
    render(
      <LoadingRegion label="Loading rides" className="grid gap-2">
        <Skeleton />
      </LoadingRegion>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading rides');
    expect(screen.getByRole('status')).toHaveClass('grid');
  });
});
