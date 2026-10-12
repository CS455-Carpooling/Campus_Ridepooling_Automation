import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RideView } from '@/lib/ride-view';
import { RideManagementControls } from './RideManagementControls';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const ride: RideView = {
  id: '0b9a7c1e-1111-4000-8000-000000000001',
  direction: 'to_hub',
  hubId: 'kanpur-central',
  hub: { name: 'Kanpur Central', detail: null },
  departureStart: '2099-10-10T01:00:00.000Z',
  departureEnd: '2099-10-10T02:00:00.000Z',
  lockAt: '2099-10-10T00:00:00.000Z',
  state: 'scheduled',
  isLocked: false,
  isOpen: true,
  windowEnded: false,
  completedAt: null,
  canComplete: false,
  canComplain: false,
  review: null,
  vehicleName: 'Car',
  capacity: 4,
  occupantCount: 2,
  seatsLeft: 2,
  totalFare: 400,
  occupants: [],
  viewerRole: 'owner',
  viewerShare: 200,
  estimatedShare: null,
  readAt: '2099-10-09T15:00:00.000Z',
};

const hubs = [{ id: 'kanpur-central', name: 'Kanpur Central' }];

function response(status: number, body: Record<string, unknown>) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

beforeEach(() => {
  router.refresh.mockReset();
  vi.unstubAllGlobals();
});

describe('RideManagementControls', () => {
  it('is available only to the scheduled ride owner', () => {
    const { rerender } = render(<RideManagementControls ride={ride} hubs={hubs} />);
    expect(screen.getByRole('heading', { name: 'Manage this ride' })).toBeInTheDocument();

    rerender(<RideManagementControls ride={{ ...ride, viewerRole: 'visitor' }} hubs={hubs} />);
    expect(screen.queryByRole('heading', { name: 'Manage this ride' })).not.toBeInTheDocument();

    rerender(
      <RideManagementControls
        ride={{ ...ride, viewerRole: 'owner', state: 'completed' }}
        hubs={hubs}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Manage this ride' })).not.toBeInTheDocument();
  });

  it('requires confirmation for an edit affecting riders and saves after confirmation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response(409, { code: 'confirmation_required', error: 'Confirm changes.' }),
      )
      .mockResolvedValueOnce(response(200, {}));
    vi.stubGlobal('fetch', fetch);
    render(<RideManagementControls ride={ride} hubs={hubs} />);

    const form = screen.getByLabelText('Expected total fare (₹)').closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    await screen.findByRole('button', { name: 'Confirm and notify riders' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and notify riders' }));

    await screen.findByRole('status');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[0][1].body).confirmAffectedRiders).toBe(false);
    expect(JSON.parse(fetch.mock.calls[1][1].body).confirmAffectedRiders).toBe(true);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('cancels only after the owner confirms and refreshes the page', async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, {}));
    vi.stubGlobal('fetch', fetch);
    render(<RideManagementControls ride={ride} hubs={hubs} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel ride' }));
    expect(screen.getByText('Cancel this ride?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel ride' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: 'cancel' });
    expect(screen.getByRole('status')).toHaveTextContent('The ride was cancelled.');
  });

  it('hides edit fields after lock while retaining cancellation and reporting server errors', async () => {
    const fetch = vi.fn().mockResolvedValue(response(409, { error: 'Pickup has started.' }));
    vi.stubGlobal('fetch', fetch);
    render(<RideManagementControls ride={{ ...ride, isLocked: true }} hubs={hubs} />);

    expect(screen.queryByLabelText('Direction')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel ride' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel ride' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pickup has started.');
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
