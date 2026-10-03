import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Place, VehicleType } from '@/lib/ride-options';
import { RoutePicker, type RouteValue } from './RoutePicker';
import { VehiclePicker } from './VehiclePicker';

const campusPlaces: Place[] = [
  { id: 'hall-6', name: 'Hall 6' },
  { id: 'main-gate', name: 'Main Gate' },
];
const hubs: Place[] = [
  { id: 'kanpur-central', name: 'Kanpur Central', detail: 'Railway station' },
  { id: 'lucknow-airport', name: 'Lucknow airport', detail: 'Airport' },
];
const vehicleTypes: VehicleType[] = [
  { id: 'car', name: 'Car', capacity: 4 },
  { id: 'vikram', name: 'Vikram', capacity: 7 },
];

function Route({ errors }: { errors?: Parameters<typeof RoutePicker>[0]['errors'] }) {
  const [value, setValue] = useState<RouteValue>({
    direction: '',
    hubId: '',
    campusLocationId: '',
  });
  return (
    <>
      <RoutePicker
        campusPlaces={campusPlaces}
        hubs={hubs}
        value={value}
        onChange={(change) => setValue((current) => ({ ...current, ...change }))}
        errors={errors}
      />
      <output>{JSON.stringify(value)}</output>
    </>
  );
}

describe('RoutePicker', () => {
  it('asks for the direction, a hub and a place on campus', async () => {
    render(<Route />);
    await userEvent.click(screen.getByRole('radio', { name: 'Leaving campus' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Lucknow airport' }));
    await userEvent.selectOptions(screen.getByLabelText('Pickup on campus'), 'Hall 6');

    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({
      direction: 'to_hub',
      hubId: 'lucknow-airport',
      campusLocationId: 'hall-6',
    });
  });

  it('words the hub and campus questions to match the direction', async () => {
    render(<Route />);
    expect(screen.getByRole('group', { name: 'Station, stand or airport' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your place on campus')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Leaving campus' }));
    expect(screen.getByRole('group', { name: 'Where are you going?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pickup on campus')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Coming to campus' }));
    expect(screen.getByRole('group', { name: 'Where are you starting from?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Drop-off on campus')).toBeInTheDocument();
  });

  it('describes each hub and explains the campus choice', () => {
    render(<Route />);
    expect(screen.getByRole('radio', { name: 'Kanpur Central' })).toHaveAccessibleDescription(
      'Railway station',
    );
    expect(screen.getByLabelText('Your place on campus')).toHaveAccessibleDescription(
      'Your hall, or Main Gate. Riders who join choose their own.',
    );
    const select = screen.getByLabelText('Your place on campus');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a place', 'Hall 6', 'Main Gate']);
  });

  it('shows each error next to its question', () => {
    render(
      <Route
        errors={{
          direction: 'Choose whether you are leaving campus or coming to campus.',
          hubId: 'Choose a station, stand or airport from the list.',
          campusLocationId: 'Choose your hall or Main Gate from the list.',
        }}
      />,
    );
    expect(
      screen.getByRole('group', { name: 'Which way are you going?' }),
    ).toHaveAccessibleDescription('Choose whether you are leaving campus or coming to campus.');
    expect(
      screen.getByRole('group', { name: 'Station, stand or airport' }),
    ).toHaveAccessibleDescription('Choose a station, stand or airport from the list.');
    expect(screen.getByLabelText('Your place on campus')).toHaveAttribute('aria-invalid', 'true');
  });
});

function Vehicle({ error }: { error?: string }) {
  const [value, setValue] = useState('');
  return (
    <>
      <VehiclePicker vehicleTypes={vehicleTypes} value={value} onChange={setValue} error={error} />
      <output>{value}</output>
    </>
  );
}

describe('VehiclePicker', () => {
  it('shows how many people each vehicle takes, the owner included', () => {
    render(<Vehicle />);
    expect(screen.getByRole('radio', { name: 'Car' })).toHaveAccessibleDescription(
      '4 people, you included',
    );
    expect(screen.getByRole('radio', { name: 'Vikram' })).toHaveAccessibleDescription(
      '7 people, you included',
    );
  });

  it('reports the chosen vehicle', async () => {
    render(<Vehicle />);
    await userEvent.click(screen.getByRole('radio', { name: 'Vikram' }));
    expect(screen.getByRole('status')).toHaveTextContent('vikram');
  });

  it('explains why the vehicle matters, and shows an error', () => {
    render(<Vehicle error="Choose a vehicle." />);
    expect(screen.getByRole('group', { name: 'Vehicle' })).toHaveAccessibleDescription(
      'The vehicle decides how many people can share the ride. Choose a vehicle.',
    );
  });
});
