import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckInButton } from './ArrivalControls';
import { TripPanel, TripStatus } from './TripPanel';
import {
  TRIP_RIDE_ID,
  farSeat,
  nearSeat,
  occupant,
  ownerSeat,
  tripRide,
  tripView,
} from './trip-test-data';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const fetchMock = vi.fn();
const arrivalsUrl = `/api/rides/${TRIP_RIDE_ID}/arrivals`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const pickupRide = (change = {}) =>
  tripRide({
    state: 'pickup_in_progress',
    trip: tripView({ pickupStartedAt: '2026-10-13T12:25:00.000Z', canStartTrip: true }),
    canComplete: true,
    ...change,
  });

describe('TripPanel: the owner runs the trip (FR-RO-09, FR-RO-10)', () => {
  it('offers Start pickup once the ride is locked, with the pickup order', () => {
    render(<TripPanel ride={tripRide({ trip: tripView({ canStartPickup: true }) })} />);
    expect(screen.getByRole('heading', { name: 'Run the trip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start pickup' })).toBeInTheDocument();
    const stops = within(screen.getByRole('list', { name: 'Pickup order' })).getAllByRole(
      'listitem',
    );
    expect(stops[0]).toHaveTextContent('1. Hall 1');
    expect(stops[0]).toHaveTextContent('About 18:00');
    expect(stops[0]).toHaveTextContent('Ananya Rao · Owner');
    expect(screen.getByText('Time unknown')).toBeInTheDocument();
    // No arrival buttons before pickup.
    expect(screen.queryByRole('button', { name: /arrived/ })).not.toBeInTheDocument();
  });

  it('shows nothing without a trip', () => {
    const { container } = render(<TripPanel ride={tripRide({ trip: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('during pickup gives each rider their buttons, and names who is unmarked when the trip starts', async () => {
    const user = userEvent.setup();
    render(
      <TripPanel
        ride={pickupRide({
          occupants: [
            ownerSeat,
            { ...nearSeat, status: 'checked_in' },
            { ...farSeat, status: 'arrived' },
          ],
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Kabir Shah arrived' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo arrived for Meera Iyer' })).toBeInTheDocument();
    expect(screen.getByText(/At the pickup point/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start the trip' }));
    expect(screen.getByRole('region', { name: 'Has everyone got in?' })).toHaveTextContent(
      'Not marked yet: Kabir Shah. They will be counted as on board.',
    );
    expect(screen.getByRole('button', { name: 'Complete the ride' })).toBeInTheDocument();
  });

  it('says everyone is marked when nobody is left to mark', async () => {
    const user = userEvent.setup();
    render(
      <TripPanel
        ride={pickupRide({
          occupants: [
            ownerSeat,
            { ...nearSeat, status: 'arrived' },
            { ...farSeat, status: 'no_show', share: null },
          ],
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start the trip' }));
    expect(screen.getByRole('region', { name: 'Has everyone got in?' })).toHaveTextContent(
      'Everyone is marked.',
    );
  });

  it('offers only Complete once in transit', () => {
    render(
      <TripPanel
        ride={tripRide({
          state: 'in_transit',
          trip: tripView({ tripStartedAt: '2026-10-13T12:45:00.000Z' }),
          canComplete: true,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Start the trip' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete the ride' })).toBeInTheDocument();
  });
});

describe('ArrivalControls', () => {
  it('marks a rider arrived, and undoes it', async () => {
    const user = userEvent.setup();
    render(<TripPanel ride={pickupRide()} />);
    await user.click(screen.getByRole('button', { name: 'Kabir Shah arrived' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(arrivalsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occupantId: 's-near', status: 'arrived' }),
    });
  });

  it('offers No-show only from the grace period end, then asks first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T12:36:00.000Z'));
    const user = userEvent.setup();
    const { rerender } = render(
      <TripPanel
        ride={pickupRide({
          occupants: [
            ownerSeat,
            { ...nearSeat, noShowAvailableAt: '2026-10-13T12:39:00.000Z' },
            farSeat,
          ],
        })}
      />,
    );
    expect(screen.getByText(/No-show from/)).toHaveTextContent('No-show from 18:09');
    expect(
      screen.queryByRole('button', { name: 'Kabir Shah is a no-show' }),
    ).not.toBeInTheDocument();

    rerender(
      <TripPanel
        ride={pickupRide({
          occupants: [
            ownerSeat,
            { ...nearSeat, noShowAvailableAt: '2026-10-13T12:30:00.000Z' },
            farSeat,
          ],
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Kabir Shah is a no-show' }));
    const question = screen.getByRole('region', { name: 'Mark Kabir Shah as a no-show?' });
    expect(question).toHaveTextContent('This cannot be undone.');
    await user.click(within(question).getByRole('button', { name: 'Yes, mark as a no-show' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(arrivalsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occupantId: 's-near', status: 'no_show' }),
      }),
    );
  });

  it("shows the server's refusal, and nothing for a no-show", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Arrivals are marked while pickup is in progress.' }), {
        status: 409,
      }),
    );
    const user = userEvent.setup();
    render(
      <TripPanel
        ride={pickupRide({
          occupants: [ownerSeat, nearSeat, { ...farSeat, status: 'no_show', share: null }],
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: /Meera Iyer/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kabir Shah arrived' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Arrivals are marked while pickup is in progress.',
    );
  });
});

describe('TripStatus: the riders follow the trip (FR-RD-10)', () => {
  const riderView = (change = {}) =>
    tripRide({
      viewerRole: 'rider',
      occupants: [ownerSeat, { ...nearSeat, isViewer: true }, farSeat],
      ...change,
    });

  it('before pickup gives the rider their stop and time, and lets them check in', () => {
    render(
      <TripStatus
        ride={riderView({
          trip: tripView({ viewerPickupAt: '2026-10-13T12:34:00.000Z', canCheckIn: true }),
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your trip' })).toBeInTheDocument();
    expect(
      screen.getByText('Pickup has not started yet. Be at Hall 2 by about 18:04.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I am at the pickup point' })).toBeInTheDocument();
    expect(screen.getByText('Kabir Shah')).toHaveTextContent('(you)');
    // Riders get no buttons for others.
    expect(screen.queryByRole('button', { name: /arrived|no-show/i })).not.toBeInTheDocument();
  });

  it('says when pickup started, and that the rider is on board once marked', () => {
    render(
      <TripStatus
        ride={riderView({
          state: 'pickup_in_progress',
          trip: tripView({ pickupStartedAt: '2026-10-13T12:25:00.000Z' }),
          occupants: [ownerSeat, { ...nearSeat, isViewer: true, status: 'arrived' }, farSeat],
        })}
      />,
    );
    expect(
      screen.getByText('Pickup started Tue 13 Oct, 17:55. The owner has marked you as on board.'),
    ).toBeInTheDocument();
  });

  it('confirms a check-in, and says when the trip is on its way', () => {
    const { rerender } = render(
      <TripStatus
        ride={riderView({
          state: 'pickup_in_progress',
          trip: tripView({ pickupStartedAt: '2026-10-13T12:25:00.000Z' }),
          occupants: [ownerSeat, { ...nearSeat, isViewer: true, status: 'checked_in' }, farSeat],
        })}
      />,
    );
    expect(screen.getByText(/You said you are at your pickup point/)).toBeInTheDocument();
    rerender(
      <TripStatus
        ride={riderView({
          state: 'in_transit',
          trip: tripView({ tripStartedAt: '2026-10-13T12:45:00.000Z' }),
        })}
      />,
    );
    expect(screen.getByText('On the way since Tue 13 Oct, 18:15.')).toBeInTheDocument();
  });

  it('tells a no-show they are off the ride, and how to dispute it (FR-RD-10.3)', () => {
    render(
      <TripStatus
        ride={riderView({ trip: tripView({ viewerNoShow: true }), canComplain: true })}
      />,
    );
    expect(screen.getByText(/marked you as a no-show/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'report it' })).toHaveAttribute(
      'href',
      `/rides/${TRIP_RIDE_ID}/complaint`,
    );
    expect(screen.queryByRole('list', { name: 'Pickup order' })).not.toBeInTheDocument();
  });

  it('lists drop-offs, without times, coming to campus', () => {
    render(
      <TripStatus
        ride={riderView({
          direction: 'from_hub',
          trip: tripView({ stopKind: 'drop_off' }),
        })}
      />,
    );
    expect(screen.getByRole('list', { name: 'Drop-off order' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Everyone gets in at Kanpur Central; this is the order people get out on campus.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/About/)).not.toBeInTheDocument();
  });

  it('skips a stop seat it cannot find, and shows nothing without a trip', () => {
    const { container, rerender } = render(<TripStatus ride={riderView({ trip: null })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <TripStatus
        ride={riderView({
          occupants: [occupant({ occupantId: 'other', isViewer: true })],
        })}
      />,
    );
    expect(screen.queryByText('Kabir Shah')).not.toBeInTheDocument();
  });
});

describe('CheckInButton (FR-RD-10.4)', () => {
  it('says the rider is at the pickup point', async () => {
    const user = userEvent.setup();
    render(<CheckInButton rideId={TRIP_RIDE_ID} />);
    await user.click(screen.getByRole('button', { name: 'I am at the pickup point' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/rides/${TRIP_RIDE_ID}/check-in`, {
        method: 'POST',
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows why it was refused', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'You can say you are at the pickup point once the ride locks.' }),
        {
          status: 409,
        },
      ),
    );
    const user = userEvent.setup();
    render(<CheckInButton rideId={TRIP_RIDE_ID} />);
    await user.click(screen.getByRole('button', { name: 'I am at the pickup point' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('once the ride locks');
  });
});
