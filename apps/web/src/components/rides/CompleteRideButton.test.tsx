import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompleteRideButton } from './CompleteRideButton';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const fetchMock = vi.fn();

function answer(status: number, body: object = {}) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

async function openQuestion() {
  const user = userEvent.setup();
  render(<CompleteRideButton rideId={RIDE_ID} />);
  await user.click(screen.getByRole('button', { name: 'Mark ride completed' }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('CompleteRideButton (FR-RO-09.4)', () => {
  it('asks before completing, and moves focus to the question', async () => {
    await openQuestion();
    const question = screen.getByRole('region', { name: 'Mark this ride completed?' });
    expect(question).toHaveFocus();
    expect(question).toHaveTextContent('A completed ride cannot be reopened.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('"Not yet" closes the question without a request and returns focus to the button', async () => {
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark ride completed' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('completes the ride and reads the page again', async () => {
    answer(200, { ride: { id: RIDE_ID, state: 'completed' } });
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, mark it completed' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(`/api/rides/${RIDE_ID}/complete`, { method: 'POST' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the reason the server gives when it refuses', async () => {
    answer(409, { error: 'This ride is already marked completed.', code: 'already_completed' });
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, mark it completed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This ride is already marked completed.',
    );
    expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Yes, mark it completed' })).toBeEnabled();
  });

  it('falls back to a general message when the answer has no reason', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 500 }));
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, mark it completed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to mark the ride completed right now.',
    );
  });

  it('sends someone whose sign-in expired to the sign-in page', async () => {
    answer(401, { error: 'Authentication required.' });
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, mark it completed' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, mark it completed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server.');
  });
});
