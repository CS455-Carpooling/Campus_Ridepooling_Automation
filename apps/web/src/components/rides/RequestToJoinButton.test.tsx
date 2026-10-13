import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestToJoinButton } from './RequestToJoinButton';

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('RequestToJoinButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    refresh.mockReset();
  });

  it('submits a join request with the selected pickup point', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'request-1', status: 'pending' }), { status: 201 }),
      );

    vi.stubGlobal('fetch', fetchMock);

    render(<RequestToJoinButton rideId="ride-1" pickupPointId="hall-6" />);

    fireEvent.click(screen.getByRole('button', { name: 'Request to Join' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rides/ride-1/requests',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(options.body));

    expect(body.pickupLocationId).toBe('hall-6');
    expect(body).not.toHaveProperty('pickupPointId');
    expect(body.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    expect(
      await screen.findByText('Join request submitted. Waiting for the ride owner.'),
    ).toBeInTheDocument();

    expect(refresh).toHaveBeenCalledOnce();

    expect(screen.getByRole('button', { name: 'Request submitted' })).toBeDisabled();
  });

  it('prevents duplicate clicks while submitting', async () => {
    let resolveFetch!: (response: Response) => void;

    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<RequestToJoinButton rideId="ride-1" pickupPointId="hall-6" />);

    const button = screen.getByRole('button', { name: 'Request to Join' });

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    expect(screen.getByRole('button', { name: 'Submitting request…' })).toBeDisabled();

    resolveFetch(
      new Response(JSON.stringify({ id: 'request-1', status: 'pending' }), { status: 201 }),
    );

    expect(
      await screen.findByText('Join request submitted. Waiting for the ride owner.'),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('displays the backend error when the active-request limit is reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'You can have at most three active join requests.',
            code: 'active_request_limit_reached',
          }),
          { status: 409 },
        ),
      ),
    );

    render(<RequestToJoinButton rideId="ride-1" pickupPointId="hall-6" />);

    fireEvent.click(screen.getByRole('button', { name: 'Request to Join' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You can have at most three active join requests.',
    );

    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not submit when the ride is full', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<RequestToJoinButton rideId="ride-1" pickupPointId="hall-6" disabled />);

    expect(screen.getByRole('button', { name: 'Request to Join' })).toBeDisabled();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
