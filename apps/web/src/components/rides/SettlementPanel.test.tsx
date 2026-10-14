import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettlementPanel } from './SettlementPanel';
import type { RideView } from '@/lib/ride-view';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const fetchMock = vi.fn();
const ride = (changes: Record<string, unknown> = {}) =>
  ({
    id: '0b9a7c1e-1111-4000-8000-000000000001',
    state: 'completed',
    viewerRole: 'rider',
    viewerSettlement: {
      occupantId: '7a2b3c4d-3333-4000-8000-000000000003',
      name: 'Rider',
      share: 125,
      status: 'due',
      method: null,
      reference: null,
    },
    ownerSettlements: [],
    trip: null,
    ...changes,
  }) as unknown as RideView;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
});
afterEach(() => vi.unstubAllGlobals());

describe('SettlementPanel', () => {
  it('lets a rider mark their own external payment paid', async () => {
    const user = userEvent.setup();
    render(<SettlementPanel ride={ride()} />);
    await user.selectOptions(screen.getByLabelText('Payment method'), 'cash');
    await user.type(screen.getByLabelText('Reference (optional)'), 'cash-123');
    await user.click(screen.getByRole('button', { name: 'Mark paid' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rides/0b9a7c1e-1111-4000-8000-000000000001/settlements/7a2b3c4d-3333-4000-8000-000000000003',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'paid', method: 'cash', reference: 'cash-123' }),
        }),
      ),
    );
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.getByText(/Payment happens outside the app/)).toBeInTheDocument();
  });

  it('shows payment details and confirm/dispute controls only to the owner', async () => {
    const user = userEvent.setup();
    const ownerRide = ride({
      viewerRole: 'owner',
      viewerSettlement: null,
      ownerSettlements: [
        {
          occupantId: '7a2b3c4d-3333-4000-8000-000000000003',
          name: 'Rider',
          share: 125,
          status: 'paid',
          method: 'upi',
          reference: 'upi-ref',
        },
      ],
    });
    render(<SettlementPanel ride={ownerRide} />);
    expect(screen.getByText(/paid · UPI · Reference upi-ref/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm receipt' }));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/settlements/7a2b3c4d-3333-4000-8000-000000000003'),
      expect.objectContaining({ body: JSON.stringify({ action: 'confirm' }) }),
    );
    expect(screen.getByRole('button', { name: 'Dispute' })).toBeInTheDocument();
  });

  it('never displays another rider’s payment reference to a rider', () => {
    render(<SettlementPanel ride={ride()} />);
    expect(screen.queryByText(/upi-ref/)).not.toBeInTheDocument();
  });

  it('does not offer a payment action to a no-show', () => {
    render(
      <SettlementPanel
        ride={ride({
          viewerSettlement: null,
          trip: { viewerNoShow: true },
        })}
      />,
    );
    expect(
      screen.getByText('No share is due because you were marked as a no-show.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument();
  });
});
