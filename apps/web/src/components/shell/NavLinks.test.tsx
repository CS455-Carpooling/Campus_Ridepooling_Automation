import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigationFor } from '@/lib/routes';
import { NavLinks } from './NavLinks';

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn<() => string | null>() }));
vi.mock('next/navigation', () => ({ usePathname }));

describe('NavLinks', () => {
  beforeEach(() => {
    usePathname.mockReset();
  });

  it('renders one link per navigation item', () => {
    usePathname.mockReturnValue('/home');
    render(<NavLinks items={navigationFor('student')} />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Find a ride' })).toHaveAttribute('href', '/rides');
  });

  it('marks only the current page', () => {
    usePathname.mockReturnValue('/rides/new');
    render(<NavLinks items={navigationFor('student')} />);
    expect(screen.getByRole('link', { name: 'Offer a ride' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Find a ride' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('marks nothing on a page outside the navigation', () => {
    usePathname.mockReturnValue('/settings');
    render(<NavLinks items={navigationFor('admin')} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });
});
