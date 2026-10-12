import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripActionButton, type TripActionButtonProps } from './TripActionButton';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const URL = '/api/rides/0b9a7c1e-1111-4000-8000-000000000001/trip';
const fetchMock = vi.fn();

function answer(status: number, body: object = {}) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

const props: TripActionButtonProps = {
  label: 'Start pickup',
  question: 'Start pickup now?',
  detail: <p>Everyone on the ride is told.</p>,
  confirm: 'Yes, start pickup',
  busy: 'Starting pickup…',
  hint: 'The ride is locked.',
  url: URL,
  body: { to: 'pickup_in_progress' },
  failure: 'Unable to start pickup right now.',
};

async function openQuestion(change: Partial<TripActionButtonProps> = {}) {
  const user = userEvent.setup();
  render(<TripActionButton {...props} {...change} />);
  await user.click(screen.getByRole('button', { name: change.ariaLabel ?? 'Start pickup' }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('TripActionButton (CS455-63)', () => {
  it('shows the button with its hint, and asks before acting, moving focus to the question', async () => {
    render(<TripActionButton {...props} />);
    expect(screen.getByText('The ride is locked.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start pickup' }));
    const question = screen.getByRole('region', { name: 'Start pickup now?' });
    expect(question).toHaveFocus();
    expect(question).toHaveTextContent('Everyone on the ride is told.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('"Not yet" closes the question without a request and returns focus to the button', async () => {
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start pickup' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the step and reads the page again once the server confirms', async () => {
    answer(200, { ride: { state: 'pickup_in_progress' } });
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, start pickup' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'pickup_in_progress' }),
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('posts without a body when it takes none', async () => {
    answer(200);
    const user = await openQuestion({ body: undefined });
    await user.click(screen.getByRole('button', { name: 'Yes, start pickup' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(URL, { method: 'POST' }));
  });

  it('shows the reason the server gives, or its own when there is none', async () => {
    answer(409, { error: 'Pickup can start once the ride locks.', code: 'not_locked' });
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, start pickup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Pickup can start once the ride locks.',
    );
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));
    await user.click(screen.getByRole('button', { name: 'Yes, start pickup' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to start pickup right now.'),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('sends a signed-out user to sign in, and explains a network failure', async () => {
    answer(401);
    const user = await openQuestion();
    await user.click(screen.getByRole('button', { name: 'Yes, start pickup' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: 'Yes, start pickup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server.');
  });

  it('takes a fuller name for its button when several sit together', async () => {
    await openQuestion({ label: 'No-show', ariaLabel: 'Kabir Shah is a no-show' });
    expect(screen.getByRole('region', { name: 'Start pickup now?' })).toBeInTheDocument();
  });
});
