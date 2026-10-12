import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INCIDENT_POLL_MS, IncidentAlert } from './IncidentAlert';
import { IncidentActions } from './IncidentActions';
import { IncidentStatusLabel } from './IncidentStatusLabel';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const ID = 'a5a5a5a5-5555-4000-8000-000000000001';
const fetchMock = vi.fn();
const summary = (unacknowledged: number) => ({
  unacknowledged,
  newest: unacknowledged
    ? { id: ID, reference: 'SOS-1A2B3C4D', rideTitle: 'To Kanpur Central' }
    : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('IncidentAlert (P-22)', () => {
  it('shows a new alert on its next check, every 3 seconds, until it is acknowledged', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(Response.json(summary(0)))
      .mockResolvedValueOnce(Response.json(summary(1)))
      .mockResolvedValueOnce(Response.json(summary(3)))
      .mockResolvedValueOnce(Response.json(summary(0)));
    render(<IncidentAlert />);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/incidents/open', { cache: 'no-store' });

    await act(async () => vi.advanceTimersByTimeAsync(INCIDENT_POLL_MS));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('New SOS alert: SOS-1A2B3C4D on To Kanpur Central');
    expect(screen.getByRole('link', { name: 'Open it' })).toHaveAttribute(
      'href',
      `/admin/incidents/${ID}`,
    );
    expect(screen.queryByRole('link', { name: 'See all' })).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(INCIDENT_POLL_MS));
    expect(screen.getByRole('alert')).toHaveTextContent('3 SOS alerts not acknowledged');
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/admin/incidents',
    );

    await act(async () => vi.advanceTimersByTimeAsync(INCIDENT_POLL_MS));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps what it showed when a check fails, and skips checks while the tab is hidden', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(Response.json(summary(1)))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }));
    const { unmount } = render(<IncidentAlert />);
    await act(async () => vi.advanceTimersByTimeAsync(INCIDENT_POLL_MS * 2));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const calls = fetchMock.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(INCIDENT_POLL_MS * 2));
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    unmount();
  });
});

describe('IncidentActions (CS455-65)', () => {
  const url = `/api/admin/incidents/${ID}`;

  it('acknowledges an open alert', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ incident: {} }));
    const user = userEvent.setup();
    render(<IncidentActions incidentId={ID} status="open" />);
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge' }),
    });
  });

  it('needs a note to close, then sends it', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ incident: {} }));
    const user = userEvent.setup();
    render(<IncidentActions incidentId={ID} status="acknowledged" />);
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close the alert' }));
    expect(screen.getByText(/Say how the incident was handled/)).toBeInTheDocument();
    expect(screen.getByLabelText('How was it handled?')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('How was it handled?'), '  Called the rider; safe.  ');
    await user.click(screen.getByRole('button', { name: 'Close the alert' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'close',
      note: 'Called the rider; safe.',
    });
  });

  it('shows why the server refused, sends a signed-out admin to sign in, and explains a failure', async () => {
    const user = userEvent.setup();
    render(<IncidentActions incidentId={ID} status="open" />);
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: 'This incident is already acknowledged.' }, { status: 409 }),
    );
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already acknowledged');

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the server'),
    );
  });

  it('shows nothing for a closed alert', () => {
    const { container } = render(<IncidentActions incidentId={ID} status="closed" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('IncidentStatusLabel', () => {
  it('names each status in words', () => {
    render(
      <>
        <IncidentStatusLabel status="open" />
        <IncidentStatusLabel status="acknowledged" />
        <IncidentStatusLabel status="closed" />
      </>,
    );
    for (const name of ['Open', 'Acknowledged', 'Closed'])
      expect(screen.getByText(name)).toBeInTheDocument();
  });
});
