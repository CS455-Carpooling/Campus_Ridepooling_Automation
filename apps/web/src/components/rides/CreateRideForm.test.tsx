import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRideForm } from './CreateRideForm';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const options = {
  campusPlaces: [{ id: 'hall-6', name: 'Hall 6' }],
  hubs: [{ id: 'kanpur-central', name: 'Kanpur Central', detail: 'Railway station' }],
  vehicleTypes: [{ id: 'car', name: 'Car', capacity: 4 }],
};

async function fillValidRide() {
  await userEvent.click(screen.getByRole('radio', { name: 'Leaving campus' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Kanpur Central' }));
  await userEvent.selectOptions(screen.getByLabelText('Pickup on campus'), 'hall-6');
  await userEvent.click(screen.getByRole('radio', { name: 'Car' }));
  await userEvent.type(screen.getByLabelText('Earliest departure'), '2099-10-10T06:30');
  await userEvent.type(screen.getByLabelText('Latest departure'), '2099-10-10T07:30');
  await userEvent.type(screen.getByLabelText('Estimated total fare (₹)'), '460');
}

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CreateRideForm', () => {
  it('displays database-provided vehicle capacity', () => {
    render(<CreateRideForm options={options} />);
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('4 people, you included')).toBeInTheDocument();
  });

  it('shows backend validation errors after submission', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'Validation failed.',
          errors: { expectedTotalFare: 'Expected total fare is invalid.' },
        }),
        { status: 400 },
      ),
    );

    render(<CreateRideForm options={options} />);
    await fillValidRide();
    await userEvent.click(screen.getByRole('button', { name: 'Create ride' }));

    expect(await screen.findByText('Expected total fare is invalid.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.');
  });

  it('shows a successful creation response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ride: { id: 'ride-1' } }), { status: 201 }),
    );

    render(<CreateRideForm options={options} />);
    await fillValidRide();
    await userEvent.click(screen.getByRole('button', { name: 'Create ride' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Ride created successfully'),
    );
  });
});