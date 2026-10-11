import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminComplaintDetail } from '@/lib/admin-complaint-queries';

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  getComplaintDetail: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/admin/complaints/c1',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock('@/lib/admin-complaint-queries', () => ({ getComplaintDetail: mocks.getComplaintDetail }));

import AdminComplaintPage from './page';

const detail = (change: Partial<AdminComplaintDetail> = {}): AdminComplaintDetail => ({
  id: 'c1',
  reference: 'CMP-1A2B3C4D',
  legacyReference: null,
  category: 'safety',
  source: 'form',
  status: 'submitted',
  actionTaken: null,
  note: null,
  version: 1,
  description: 'Drove far too fast on the highway and would not slow down.',
  createdAt: '2026-10-11T04:00:00.000Z',
  resolvedAt: null,
  resolvedBy: null,
  complainant: { id: 'u1', name: 'Sneha Iyer', email: 'sneha@iitk.ac.in' },
  accused: { id: 'u2', name: 'Dev Patel', email: 'dev@iitk.ac.in' },
  ride: {
    id: 'r1',
    title: 'Hall 6 to Kanpur Central',
    departureStart: '2026-10-10T06:30:00.000Z',
    departureEnd: '2026-10-10T07:30:00.000Z',
    state: 'completed',
  },
  messages: [],
  earlierAboutAccused: [],
  aiHistory: [],
  ...change,
});

const open = (id = 'c1') =>
  AdminComplaintPage({ params: Promise.resolve({ id }) } as PageProps<'/admin/complaints/[id]'>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
  mocks.getComplaintDetail.mockResolvedValue(detail());
});

describe('/admin/complaints/[id] (CS455-53, OA-FR-18, 20)', () => {
  it('shows the original words, the people, the ride and the status actions', async () => {
    render(await open());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Complaint CMP-1A2B3C4D' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Safety')).toBeInTheDocument();
    expect(
      screen.getByText('Drove far too fast on the highway and would not slow down.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Exactly as filed. It can never be edited, by anyone.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sneha Iyer' })).toHaveAttribute(
      'href',
      '/admin/riders/u1',
    );
    expect(screen.getByRole('link', { name: 'Dev Patel' })).toHaveAttribute(
      'href',
      '/admin/riders/u2',
    );
    expect(screen.getByRole('link', { name: 'Hall 6 to Kanpur Central' })).toHaveAttribute(
      'href',
      '/admin/rides/r1',
    );
    expect(screen.getByRole('button', { name: 'Mark under review' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Resolve this complaint' })).toBeInTheDocument();
    expect(screen.getByText('None.')).toBeInTheDocument();
    expect(screen.getByText(/Manual review required/)).toBeInTheDocument();
  });

  it('shows the reported chat messages and the other complaints about the same person', async () => {
    mocks.getComplaintDetail.mockResolvedValue(
      detail({
        source: 'chat_report',
        legacyReference: 'chat-fa0a0f50',
        messages: [
          {
            id: 'm1',
            body: 'Hurry up or I leave.',
            sentAt: '2026-10-10T06:00:00.000Z',
            senderName: 'Dev Patel',
          },
        ],
        earlierAboutAccused: [
          {
            id: 'c0',
            reference: 'CMP-0A0B0C0D',
            category: 'tardiness',
            status: 'resolved',
            createdAt: '2026-10-01T06:00:00.000Z',
          },
        ],
      }),
    );
    render(await open());
    expect(
      screen.getByText(/From a reported chat message.*Chat report chat-fa0a0f50/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reported chat messages' })).toBeInTheDocument();
    expect(screen.getByText('Hurry up or I leave.')).toBeInTheDocument();
    const earlier = screen
      .getByRole('heading', { name: 'Other complaints about Dev Patel' })
      .closest('section') as HTMLElement;
    expect(within(earlier).getByRole('link', { name: 'CMP-0A0B0C0D' })).toHaveAttribute(
      'href',
      '/admin/complaints/c0',
    );
  });

  it('shows the outcome of a resolved complaint, without actions', async () => {
    mocks.getComplaintDetail.mockResolvedValue(
      detail({
        status: 'resolved',
        actionTaken: true,
        note: 'Warned the owner.',
        resolvedAt: '2026-10-11T05:00:00.000Z',
        resolvedBy: 'Ops Admin',
      }),
    );
    render(await open());
    expect(screen.getByText('Action was taken')).toBeInTheDocument();
    expect(screen.getByText(/by Ops Admin/)).toBeInTheDocument();
    expect(screen.getByText('Warned the owner.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Resolve this complaint' })).not.toBeInTheDocument();
  });

  it('shows validated advisory analysis and its approval boundary', async () => {
    mocks.getComplaintDetail.mockResolvedValue(
      detail({
        aiHistory: [
          {
            id: 'analysis-1',
            outcome: 'ai_validated',
            summary: 'The report describes unsafe driving.',
            severity: 'high',
            behaviorTags: ['safety_risk'],
            recommendedAction: 'warning',
            recommendedSuspensionDays: null,
            recommendedIndefinite: false,
            confidence: 0.9,
            createdAt: '2026-10-11T05:00:00.000Z',
            decision: null,
          },
        ],
      }),
    );
    render(await open());
    expect(screen.getByRole('heading', { name: 'AI complaint review' })).toBeInTheDocument();
    expect(screen.getByText('The report describes unsafe driving.')).toBeInTheDocument();
    expect(screen.getByText('Recommended action:').parentElement).toHaveTextContent('Warning');
    expect(
      screen.getByRole('form', { name: 'Decide on AI recommendation analysis-1' }),
    ).toBeInTheDocument();
  });

  it('is not found for an unknown complaint, and not for students', async () => {
    mocks.getComplaintDetail.mockResolvedValue(null);
    await expect(open('nope')).rejects.toThrow('NEXT_NOT_FOUND');
    mocks.requireAdminPage.mockResolvedValue(null);
    render(await open());
    expect(
      screen.getByRole('heading', { name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
  });
});
