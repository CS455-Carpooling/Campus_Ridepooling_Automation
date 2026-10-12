import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  getAdminRide: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/admin/rides/r1',
}));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock('@/lib/admin-rider-queries', () => ({ getAdminRide: mocks.getAdminRide }));

import AdminRidePage from './page';

const open = (id = 'r1') =>
  AdminRidePage({ params: Promise.resolve({ id }) } as PageProps<'/admin/rides/[id]'>);

const ride = {
  id: 'r1',
  title: 'Hall 6 to Kanpur Central',
  state: 'completed',
  departureStart: '2026-10-10T01:00:00.000Z',
  departureEnd: '2026-10-10T02:00:00.000Z',
  vehicleName: 'Auto',
  capacity: 3,
  totalFare: 400,
  createdAt: '2026-10-09T10:00:00.000Z',
  completedAt: '2026-10-10T03:00:00.000Z',
  pickupStartedAt: '2026-10-10T00:55:00.000Z',
  tripStartedAt: '2026-10-10T01:10:00.000Z',
  occupants: [
    {
      userId: 'u1',
      name: 'Rohan',
      isOwner: true,
      campusPlace: 'Hall 6',
      joinedAt: '2026-10-09T10:00:00.000Z',
      status: 'waiting',
      finalShare: 250,
    },
    {
      userId: 'u2',
      name: 'Aditi',
      isOwner: false,
      campusPlace: 'Hall 1',
      joinedAt: '2026-10-09T11:00:00.000Z',
      status: 'no_show',
      finalShare: null,
    },
  ],
  complaints: [{ id: 'c1', reference: 'CMP-1A2B3C4D', category: 'tardiness', status: 'resolved' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
  mocks.getAdminRide.mockResolvedValue(ride);
});

describe('/admin/rides/[id] (CS455-53, SYS-FR-17)', () => {
  it('shows the ride read only, with its people and complaints', async () => {
    render(await open());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hall 6 to Kanpur Central' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Read only. Admins can see a ride but never change it.'),
    ).toBeInTheDocument();
    expect(screen.getByText('₹400')).toBeInTheDocument();
    const people = within(screen.getByRole('list', { name: 'People on this ride' })).getAllByRole(
      'listitem',
    );
    expect(within(people[0]).getByRole('link', { name: 'Rohan' })).toHaveAttribute(
      'href',
      '/admin/riders/u1',
    );
    expect(people[0]).toHaveTextContent('Owner, Hall 6');
    // CS455-63: the trip's times, who was a no-show, and the final shares.
    expect(people[0]).toHaveTextContent('Final share ₹250');
    expect(people[1]).toHaveTextContent('No-show');
    expect(screen.getByText('Sat 10 Oct, 06:25')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CMP-1A2B3C4D' })).toHaveAttribute(
      'href',
      '/admin/complaints/c1',
    );
    expect(screen.queryByRole('button', { name: /edit|cancel|complete/i })).not.toBeInTheDocument();
  });

  it('says when there are no complaints, and is not found for an unknown ride', async () => {
    mocks.getAdminRide.mockResolvedValue({
      ...ride,
      complaints: [],
      completedAt: null,
      pickupStartedAt: null,
      tripStartedAt: null,
    });
    render(await open());
    expect(screen.getByText('None.')).toBeInTheDocument();
    expect(screen.getAllByText('Not yet')).toHaveLength(3);
    mocks.getAdminRide.mockResolvedValue(null);
    await expect(open('x')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('shows a student the "not for you" page', async () => {
    mocks.requireAdminPage.mockResolvedValue(null);
    render(await open());
    expect(
      screen.getByRole('heading', { name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
    expect(mocks.getAdminRide).not.toHaveBeenCalled();
  });
});
