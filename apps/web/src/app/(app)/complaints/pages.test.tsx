import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComplaintFormPage } from '@/lib/complaint-queries';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getMyComplaints: vi.fn(),
  getComplaintFormPage: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/session', () => ({ requireRiderProfileSetup: vi.fn() }));
vi.mock('@/lib/complaint-queries', () => ({
  getMyComplaints: mocks.getMyComplaints,
  getComplaintFormPage: mocks.getComplaintFormPage,
}));

import RideComplaintPage from '../rides/[id]/complaint/page';
import MyComplaintsPage from './page';

const USER = '6f1c2a5e-2222-4000-8000-000000000001';
const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';

const formPage = (change: Partial<ComplaintFormPage> = {}): ComplaintFormPage => ({
  rideId: RIDE,
  title: 'Hall 6 to Kanpur Central',
  direction: 'to_hub',
  departureStart: '2026-10-10T01:00:00.000Z',
  departureEnd: '2026-10-10T02:00:00.000Z',
  state: 'completed',
  window: 'open',
  closesAt: '2026-10-17T03:00:00.000Z',
  people: [
    {
      occupantId: 'seat-1',
      name: 'Rohan Verma',
      isOwner: true,
      campusPlace: 'Hall 6',
      filedReference: null,
    },
  ],
  message: null,
  sosAvailable: false,
  ...change,
});

const openForm = (query: Record<string, string> = {}) =>
  RideComplaintPage({
    params: Promise.resolve({ id: RIDE }),
    searchParams: Promise.resolve(query),
  } as PageProps<'/rides/[id]/complaint'>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: USER });
  mocks.getMyComplaints.mockResolvedValue([]);
  mocks.getComplaintFormPage.mockResolvedValue(formPage());
});

describe('/rides/[id]/complaint (CS455-53)', () => {
  it('shows the form for someone on the ride, passing a reported message on', async () => {
    render(await openForm({ message: 'msg-1' }));
    expect(mocks.getComplaintFormPage).toHaveBeenCalledWith(RIDE, USER, 'msg-1');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hall 6 to Kanpur Central' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send complaint' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the ride' })).toHaveAttribute(
      'href',
      `/rides/${RIDE}`,
    );
  });

  it.each([
    ['not_completed', /once the owner marks the ride completed/],
    ['cancelled', /This ride was cancelled/],
    ['closed', /Complaints about this trip closed on/],
  ] as const)(
    'explains why a trip complaint cannot be filed when the window is %s',
    async (window, text) => {
      mocks.getComplaintFormPage.mockResolvedValue(formPage({ window }));
      render(await openForm());
      expect(screen.getByText(text)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Send complaint' })).not.toBeInTheDocument();
    },
  );

  it('is "not found" for anyone not on the ride, and asks the signed-out to sign in', async () => {
    mocks.getComplaintFormPage.mockResolvedValue(null);
    await expect(openForm()).rejects.toThrow('NEXT_NOT_FOUND');
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(openForm()).rejects.toThrow('redirect:/login');
  });
});

describe('/complaints (CS455-53, FR-RD-13.5)', () => {
  it('lists your complaints with status, and only whether action was taken', async () => {
    mocks.getMyComplaints.mockResolvedValue([
      {
        reference: 'CMP-1A2B3C4D',
        rideId: RIDE,
        rideTitle: 'Hall 6 to Kanpur Central',
        departureStart: '2026-10-10T01:00:00.000Z',
        about: 'Rohan Verma',
        category: 'tardiness',
        status: 'resolved',
        actionTaken: true,
        filedAt: '2026-10-11T04:00:00.000Z',
      },
      {
        reference: 'CMP-2B3C4D5E',
        rideId: RIDE,
        rideTitle: 'Hall 6 to Kanpur Central',
        departureStart: '2026-10-10T01:00:00.000Z',
        about: 'Dev Patel',
        category: 'payment',
        status: 'submitted',
        actionTaken: null,
        filedAt: '2026-10-11T05:00:00.000Z',
      },
    ]);
    render(await MyComplaintsPage());
    const [first, second] = within(
      screen.getByRole('list', { name: 'Your complaints' }),
    ).getAllByRole('listitem');
    expect(first).toHaveTextContent('CMP-1A2B3C4D');
    expect(first).toHaveTextContent('Tardiness, about Rohan Verma');
    expect(within(first).getByText('Resolved')).toBeInTheDocument();
    expect(first).toHaveTextContent('Action was taken');
    expect(within(second).getByText('Submitted')).toBeInTheDocument();
    expect(second).not.toHaveTextContent('action was taken');
  });

  it('says how to report a problem when there are none, and asks the signed-out to sign in', async () => {
    render(await MyComplaintsPage());
    expect(screen.getByText(/You have not filed a complaint/)).toBeInTheDocument();
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(MyComplaintsPage()).rejects.toThrow('redirect:/login');
  });
});
