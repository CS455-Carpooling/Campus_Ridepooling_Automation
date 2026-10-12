import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  listComplaints: vi.fn(),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/complaints' }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock('@/lib/admin-complaint-queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin-complaint-queries')>()),
  listComplaints: mocks.listComplaints,
}));

import AdminComplaintsPage from './page';

const open = (params: Record<string, string> = {}) =>
  AdminComplaintsPage({ searchParams: Promise.resolve(params) } as PageProps<'/admin/complaints'>);

const complaint = (change: Record<string, unknown> = {}) => ({
  id: 'c0c0c0c0-1111-4000-8000-000000000001',
  reference: 'CMP-1A2B3C4D',
  category: 'safety',
  source: 'form',
  status: 'submitted',
  createdAt: '2026-10-11T04:00:00.000Z',
  about: 'Dev Patel',
  rideTitle: 'Hall 6 to Kanpur Central',
  ...change,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
  mocks.listComplaints.mockResolvedValue([]);
});

describe('/admin/complaints (CS455-53)', () => {
  it('shows a student the "not for you" page, without reading complaints', async () => {
    mocks.requireAdminPage.mockResolvedValue(null);
    render(await open());
    expect(
      screen.getByRole('heading', { name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
    expect(mocks.listComplaints).not.toHaveBeenCalled();
  });

  it('lists open complaints by default, form and chat reports together', async () => {
    mocks.listComplaints.mockResolvedValue([
      complaint(),
      complaint({
        id: 'c2',
        reference: 'CMP-2B3C4D5E',
        category: 'other',
        source: 'chat_report',
        status: 'under_review',
      }),
    ]);
    render(await open());
    expect(mocks.listComplaints).toHaveBeenCalledWith({
      status: 'open',
      category: 'all',
      source: 'all',
    });
    const items = within(screen.getByRole('list', { name: 'Complaints' })).getAllByRole('listitem');
    expect(within(items[0]).getByRole('link', { name: 'CMP-1A2B3C4D' })).toHaveAttribute(
      'href',
      '/admin/complaints/c0c0c0c0-1111-4000-8000-000000000001',
    );
    expect(items[0]).toHaveTextContent('Safety');
    expect(items[0]).toHaveTextContent('About Dev Patel, on Hall 6 to Kanpur Central.');
    expect(within(items[0]).getByText('Submitted')).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('Chat report');
    expect(within(items[1]).getByText('Under review')).toBeInTheDocument();
  });

  it('applies the filters from the URL and shows them in the form', async () => {
    render(await open({ status: 'resolved', category: 'payment', source: 'chat_report' }));
    expect(mocks.listComplaints).toHaveBeenCalledWith({
      status: 'resolved',
      category: 'payment',
      source: 'chat_report',
    });
    const form = within(screen.getByRole('form', { name: 'Filter complaints' }));
    expect(form.getByLabelText('Status')).toHaveValue('resolved');
    expect(form.getByLabelText('Category')).toHaveValue('payment');
    expect(form.getByLabelText('Came from')).toHaveValue('chat_report');
    expect(screen.getByText('No complaints match these filters.')).toBeInTheDocument();
  });

  it('ignores unknown filter values', async () => {
    render(await open({ status: 'deleted', category: 'sos', source: 'email' }));
    expect(mocks.listComplaints).toHaveBeenCalledWith({
      status: 'open',
      category: 'all',
      source: 'all',
    });
  });
});
