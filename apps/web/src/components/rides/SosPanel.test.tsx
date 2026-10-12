import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SosIncident } from '@/lib/sos';
import { SosPanel } from './SosPanel';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const fetchMock = vi.fn();

const incident = (change: Partial<SosIncident> = {}): SosIncident => ({
  id: 'a5a5a5a5-5555-4000-8000-000000000001',
  reference: 'SOS-1A2B3C4D',
  raisedAt: '2026-10-13T12:40:00.000Z',
  status: 'open',
  locationShared: false,
  falseAlarm: false,
  ...change,
});

function answer(status: number, body: object) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

/** Geolocation that answers with a position, refuses, or is missing. */
function geolocation(mode: 'allow' | 'refuse' | 'missing') {
  if (mode === 'missing') {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    Reflect.deleteProperty(globalThis.navigator, 'geolocation');
    return;
  }
  const getCurrentPosition = vi.fn((success: PositionCallback, failure: PositionErrorCallback) => {
    if (mode === 'allow') {
      success({
        coords: { latitude: 26.51, longitude: 80.23, accuracy: 12 },
      } as GeolocationPosition);
    } else {
      failure({ code: 1, message: 'denied' } as GeolocationPositionError);
    }
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

async function confirmSos() {
  const user = userEvent.setup();
  render(<SosPanel rideId={RIDE_ID} incident={null} canRaise />);
  await user.click(screen.getByRole('button', { name: 'SOS' }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('SosPanel (FR-RD-15)', () => {
  it('asks first, with the emergency numbers and the no-dispatch note already on screen', async () => {
    await confirmSos();
    const question = screen.getByRole('region', { name: 'Send an SOS alert?' });
    expect(question).toHaveFocus();
    expect(question).toHaveTextContent('The others on this ride are not told.');
    expect(within(question).getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
    expect(question).toHaveTextContent('does not contact emergency services');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('"Not now" goes back without sending', async () => {
    const user = await confirmSos();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.getByRole('button', { name: 'SOS' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the alert first, then shares the location if allowed (FR-RD-15.2)', async () => {
    const asked = geolocation('allow');
    answer(201, { incident: incident() });
    answer(200, { incident: incident({ locationShared: true }) });
    const user = await confirmSos();
    await user.click(screen.getByRole('button', { name: 'Yes, send SOS' }));
    expect(
      await screen.findByRole('heading', { name: 'Your SOS alert was sent' }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]).toEqual([`/api/rides/${RIDE_ID}/sos`, { method: 'POST' }]);
    expect(asked).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
    await waitFor(() =>
      expect(screen.getByText('Your location was shared with the admins.')).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/sos/${incident().id}`);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      latitude: 26.51,
      longitude: 80.23,
      accuracy: 12,
    });
    expect(screen.getByText('SOS-1A2B3C4D')).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it('keeps the alert when location is refused or not available', async () => {
    geolocation('refuse');
    answer(201, { incident: incident() });
    const user = await confirmSos();
    await user.click(screen.getByRole('button', { name: 'Yes, send SOS' }));
    expect(
      await screen.findByText(
        'Your location was not shared. The admins still have the trip details.',
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says so when there is no location service at all', async () => {
    geolocation('missing');
    answer(201, { incident: incident() });
    const user = await confirmSos();
    await user.click(screen.getByRole('button', { name: 'Yes, send SOS' }));
    expect(await screen.findByText(/Your location was not shared/)).toBeInTheDocument();
  });

  it('when the alert cannot be sent, says to call for help, with the numbers still on screen', async () => {
    answer(429, { error: 'Too many attempts.' });
    const user = await confirmSos();
    await user.click(screen.getByRole('button', { name: 'Yes, send SOS' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.');
    expect(screen.getByRole('link', { name: '112' })).toBeInTheDocument();

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: 'Yes, send SOS' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Call 112 or campus security now.'),
    );
  });

  it('shows an alert already raised, and marks it a false alarm after asking (FR-RD-15.5)', async () => {
    answer(200, { incident: incident({ falseAlarm: true }) });
    const user = userEvent.setup();
    const { rerender } = render(
      <SosPanel rideId={RIDE_ID} incident={incident({ locationShared: true })} canRaise />,
    );
    expect(screen.getByText('Your location was shared with the admins.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'It was a false alarm' }));
    const question = screen.getByRole('region', { name: 'Mark as a false alarm?' });
    expect(question).toHaveFocus();
    await user.click(within(question).getByRole('button', { name: 'Yes, it was a false alarm' }));
    expect(
      await screen.findByText(/You marked your alert SOS-1A2B3C4D as a false alarm/),
    ).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ falseAlarm: true });
    // A new SOS can still be sent.
    expect(screen.getByRole('button', { name: 'SOS' })).toBeInTheDocument();

    // The server's view wins when the page is read again.
    rerender(
      <SosPanel rideId={RIDE_ID} incident={incident({ reference: 'SOS-99999999' })} canRaise />,
    );
    expect(screen.getByText('SOS-99999999')).toBeInTheDocument();
  });

  it('can keep the alert, and shows a refused false alarm', async () => {
    answer(409, { error: 'An operations admin has closed this alert.' });
    const user = userEvent.setup();
    render(<SosPanel rideId={RIDE_ID} incident={incident()} canRaise={false} />);
    await user.click(screen.getByRole('button', { name: 'It was a false alarm' }));
    await user.click(screen.getByRole('button', { name: 'Keep the alert' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'It was a false alarm' }));
    await user.click(screen.getByRole('button', { name: 'Yes, it was a false alarm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('closed this alert');
  });

  it('shows nothing when SOS is not available and there is no alert', () => {
    const { container } = render(<SosPanel rideId={RIDE_ID} incident={null} canRaise={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
