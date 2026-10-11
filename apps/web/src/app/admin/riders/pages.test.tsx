import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RiderRecord } from '@/lib/admin-rider-queries';

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  searchRiders: vi.fn(),
  getRiderRecord: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/admin/riders',
}));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock('@/lib/admin-rider-queries', () => ({
  searchRiders: mocks.searchRiders,
  getRiderRecord: mocks.getRiderRecord,
}));

import AdminRiderPage from './[id]/page';
import AdminRidersPage from './page';

const search = (params: Record<string, string> = {}) =>
  AdminRidersPage({ searchParams: Promise.resolve(params) } as PageProps<'/admin/riders'>);
const record = (id = 'u2') =>
  AdminRiderPage({ params: Promise.resolve({ id }) } as PageProps<'/admin/riders/[id]'>);

const rider: RiderRecord = {
  id: 'u2',
  fullName: 'Dev Patel',
  displayName: 'Dev',
  email: 'dev@iitk.ac.in',
  rollNumber: '220001',
  mobile: null,
  isAdmin: false,
  verified: true,
  joinedAt: '2026-10-01T06:00:00.000Z',
  suspension: {
    id: 's1',
    reasonCategory: 'safety',
    startsAt: '2026-10-11T00:00:00.000Z',
    endsAt: '2026-10-14T00:00:00.000Z',
    isIndefinite: false,
  },
  rides: [
    {
      id: 'r1',
      title: 'Hall 6 to Kanpur Central',
      departureStart: '2026-10-10T06:30:00.000Z',
      state: 'completed',
      asOwner: true,
    },
  ],
  complaintsFiled: [],
  complaintsReceived: [
    {
      id: 'c1',
      reference: 'CMP-1A2B3C4D',
      category: 'safety',
      status: 'submitted',
      createdAt: '2026-10-11T04:00:00.000Z',
    },
  ],
  warnings: [
    {
      id: 'w1',
      reason: 'Late twice',
      issuedAt: '2026-10-11T03:00:00.000Z',
      issuedBy: 'Ops Admin',
      complaintReference: 'CMP-1A2B3C4D',
    },
  ],
  suspensions: [
    {
      id: 's0',
      reasonCategory: 'tardiness',
      reason: 'Repeated lateness',
      startsAt: '2026-10-05T00:00:00.000Z',
      endsAt: '2026-10-06T00:00:00.000Z',
      isIndefinite: false,
      issuedBy: 'Ops Admin',
      liftedAt: '2026-10-05T12:00:00.000Z',
      liftedBy: 'Ops Admin',
      liftReason: 'Appeal accepted',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
  mocks.searchRiders.mockResolvedValue([]);
  mocks.getRiderRecord.mockResolvedValue(rider);
});

describe('/admin/riders (CS455-53, OA-FR-42)', () => {
  it('asks for a search, and searches only from 2 characters', async () => {
    render(await search());
    expect(screen.getByRole('search', { name: 'Find a rider' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Riders found' })).not.toBeInTheDocument();
    render(await search({ q: 'zz' }));
    expect(mocks.searchRiders).toHaveBeenCalledWith('zz');
    expect(screen.getByText(/No rider matches/)).toBeInTheDocument();
  });

  it('lists the riders found, linking to each record', async () => {
    mocks.searchRiders.mockResolvedValue([
      {
        id: 'u2',
        name: 'Dev',
        email: 'dev@iitk.ac.in',
        rollNumber: '220001',
        isAdmin: false,
        suspended: true,
      },
      {
        id: 'a1',
        name: 'Ops Admin',
        email: 'ops@iitk.ac.in',
        rollNumber: 'OPS',
        isAdmin: true,
        suspended: false,
      },
    ]);
    render(await search({ q: 'iitk' }));
    const items = within(screen.getByRole('list', { name: 'Riders found' })).getAllByRole(
      'listitem',
    );
    expect(within(items[0]).getByRole('link', { name: 'Dev' })).toHaveAttribute(
      'href',
      '/admin/riders/u2',
    );
    expect(items[0]).toHaveTextContent('Suspended');
    expect(items[1]).toHaveTextContent('Operations admin');
    expect(screen.getByLabelText('Name, email or roll number')).toHaveValue('iitk');
  });

  it('shows a student the "not for you" page', async () => {
    mocks.requireAdminPage.mockResolvedValue(null);
    render(await search({ q: 'dev' }));
    expect(
      screen.getByRole('heading', { name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
    expect(mocks.searchRiders).not.toHaveBeenCalled();
  });
});

describe('/admin/riders/[id] (CS455-53, OA-FR-42, SYS-NFR-07)', () => {
  it('shows identity, status, rides, complaints, warnings and suspensions', async () => {
    render(await record());
    expect(screen.getByRole('heading', { level: 1, name: 'Dev' })).toBeInTheDocument();
    expect(screen.getByText(/Account status: Suspended until .* \(Safety\)/)).toBeInTheDocument();
    expect(screen.getByText('dev@iitk.ac.in')).toBeInTheDocument();
    expect(screen.getByText('Not given')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hall 6 to Kanpur Central' })).toHaveAttribute(
      'href',
      '/admin/rides/r1',
    );
    expect(
      within(screen.getByRole('list', { name: 'Complaints about them' })).getByRole('link', {
        name: 'CMP-1A2B3C4D',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Late twice')).toBeInTheDocument();
    expect(screen.getByText(/Lifted .* by Ops Admin: Appeal accepted/)).toBeInTheDocument();
    expect(screen.getAllByText('None.').length).toBeGreaterThan(0);
  });

  it('shows an active account, and is not found for an unknown rider', async () => {
    mocks.getRiderRecord.mockResolvedValue({
      ...rider,
      suspension: null,
      warnings: [],
      suspensions: [],
      rides: [],
    });
    render(await record());
    expect(screen.getByText('Account status: Active')).toBeInTheDocument();
    expect(screen.getByText('No warnings.')).toBeInTheDocument();
    expect(screen.getByText('No rides yet.')).toBeInTheDocument();
    mocks.getRiderRecord.mockResolvedValue(null);
    await expect(record('x')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
