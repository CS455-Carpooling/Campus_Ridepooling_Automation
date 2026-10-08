import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RatingPage } from '@/lib/ride-ratings';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getRatingPage: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/ride-ratings', () => ({ getRatingPage: mocks.getRatingPage }));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import RideReviewPage from './page';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const user = {
  id: '6f1c2a5e-2222-4000-8000-000000000002',
  email: 'a@iitk.ac.in',
  full_name: 'A',
  roll_number: '1',
};

const props = (id = RIDE_ID) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});

const ratingPage: RatingPage = {
  rideId: RIDE_ID,
  title: 'To Kanpur Central',
  direction: 'to_hub',
  departureStart: '2026-10-10T01:00:00.000Z',
  departureEnd: '2026-10-10T02:00:00.000Z',
  state: 'completed',
  window: 'open',
  completedAt: '2026-10-10T02:35:00.000Z',
  closesAt: '2026-10-13T02:35:00.000Z',
  viewerRole: 'rider',
  people: [],
};

beforeEach(() => {
  mocks.getCurrentUser.mockReset();
  mocks.getRatingPage.mockReset();
  mocks.redirect.mockClear();
  mocks.notFound.mockClear();
});

describe('review page', () => {
  it('sends a signed-out visitor to sign in, without reading the ride', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(RideReviewPage(props())).rejects.toThrow('REDIRECT:/login');
    expect(mocks.getRatingPage).not.toHaveBeenCalled();
  });

  it('answers not found for a missing ride, or for someone without a seat on it', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.getRatingPage.mockResolvedValue(null);
    await expect(RideReviewPage(props('abc'))).rejects.toThrow('NOT_FOUND');
    expect(mocks.getRatingPage).toHaveBeenCalledWith('abc', user.id);
  });

  it('shows the review page to someone on the ride', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.getRatingPage.mockResolvedValue(ratingPage);
    render(await RideReviewPage(props()));
    expect(mocks.getRatingPage).toHaveBeenCalledWith(RIDE_ID, user.id);
    expect(
      screen.getByRole('heading', { level: 1, name: 'To Kanpur Central' }),
    ).toBeInTheDocument();
  });

  it('lets a database failure reach the error page instead of claiming the ride is missing', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.getRatingPage.mockRejectedValue(new Error('connection refused'));
    await expect(RideReviewPage(props())).rejects.toThrow('connection refused');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
