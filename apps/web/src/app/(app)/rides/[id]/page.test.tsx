import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getRideView: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/ride-view', () => ({ getRideView: mocks.getRideView }));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import RidePage from './page';

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

const view = {
  id: RIDE_ID,
  direction: 'to_hub',
  hub: { name: 'Kanpur Central', detail: null },
  departureStart: '2026-10-10T01:00:00.000Z',
  departureEnd: '2026-10-10T02:00:00.000Z',
  lockAt: '2026-10-10T00:00:00.000Z',
  state: 'scheduled',
  isLocked: false,
  isOpen: true,
  windowEnded: false,
  vehicleName: 'Car',
  capacity: 4,
  occupantCount: 1,
  seatsLeft: 3,
  totalFare: 350,
  occupants: [{ name: 'A', campusPlace: 'Hall 6', isOwner: true, isViewer: true, share: 350 }],
  viewerRole: 'owner',
  viewerShare: 350,
  estimatedShare: null,
  readAt: '2026-10-09T15:42:05.000Z',
};

beforeEach(() => {
  mocks.getCurrentUser.mockReset();
  mocks.getRideView.mockReset();
  mocks.redirect.mockClear();
  mocks.notFound.mockClear();
});

describe('ride details page', () => {
  it('sends a signed-out visitor to sign in, without reading the ride', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(RidePage(props())).rejects.toThrow('REDIRECT:/login');
    expect(mocks.getRideView).not.toHaveBeenCalled();
  });

  it('answers not found when the ride is missing or not visible to the viewer', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.getRideView.mockResolvedValue(null);
    await expect(RidePage(props('abc'))).rejects.toThrow('NOT_FOUND');
    expect(mocks.getRideView).toHaveBeenCalledWith('abc', user.id);
  });

  it('shows the ride to the signed-in viewer', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.getRideView.mockResolvedValue(view);
    render(await RidePage(props()));
    expect(mocks.getRideView).toHaveBeenCalledWith(RIDE_ID, user.id);
    expect(
      screen.getByRole('heading', { level: 1, name: 'To Kanpur Central' }),
    ).toBeInTheDocument();
  });

  it('lets a database failure reach the error page instead of claiming the ride is missing', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.getRideView.mockRejectedValue(new Error('connection refused'));
    await expect(RidePage(props())).rejects.toThrow('connection refused');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
