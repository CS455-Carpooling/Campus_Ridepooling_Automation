import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchRideForm } from './SearchRideForm';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const options = {
  campusPlaces: [{ id: 'hall-6', name: 'Hall 6' }],
  hubs: [{ id: 'kanpur-central', name: 'Kanpur Central', detail: 'Railway station' }],
  vehicleTypes: [
    { id: 'auto', name: 'Auto', capacity: 3 },
    { id: 'car', name: 'Car', capacity: 4 },
  ],
};

async function fillRequiredFields() {
  await userEvent.click(screen.getByRole('radio', { name: 'Leaving campus' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Kanpur Central' }));
  await userEvent.selectOptions(screen.getByLabelText('Pickup on campus'), 'hall-6');
  await userEvent.type(screen.getByLabelText('Earliest departure'), '2099-10-10T06:30');
  await userEvent.type(screen.getByLabelText('Latest departure'), '2099-10-10T07:30');
}

/** The query string of the results URL the form navigated to. */
function sentParams(): URLSearchParams {
  const url = String(push.mock.calls.at(-1)?.[0]);
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
}

beforeEach(() => {
  push.mockReset();
});

describe('SearchRideForm', () => {
  it('starts with no optional filters when the profile saves none', () => {
    render(<SearchRideForm options={options} />);
    expect(screen.getByLabelText('Vehicle type')).toHaveValue('');
    expect(screen.getByLabelText('Maximum fare share')).toHaveValue('');
  });

  it("pre-fills the profile's vehicle type and maximum share, and says so (FR-RD-02.5)", () => {
    render(
      <SearchRideForm options={options} defaults={{ vehicleTypeId: 'auto', maxFareShare: 150 }} />,
    );
    expect(screen.getByLabelText('Vehicle type')).toHaveValue('auto');
    expect(screen.getByLabelText('Maximum fare share')).toHaveValue('150');
    expect(
      screen.getByText('From your profile. Choose Any vehicle to see all.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('From your profile. Choose Any amount to see all.'),
    ).toBeInTheDocument();
  });

  it('searches with the pre-filled filters', async () => {
    render(
      <SearchRideForm options={options} defaults={{ vehicleTypeId: 'auto', maxFareShare: 150 }} />,
    );
    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: 'Search rides' }));
    expect(sentParams().get('vehicleTypeId')).toBe('auto');
    expect(sentParams().get('maxFareShare')).toBe('150');
  });

  it('lets the rider choose Any, and then searches without the saved filters', async () => {
    render(
      <SearchRideForm options={options} defaults={{ vehicleTypeId: 'auto', maxFareShare: 150 }} />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Vehicle type'), '');
    await userEvent.selectOptions(screen.getByLabelText('Maximum fare share'), '');
    expect(
      screen.getByText('Filter by vehicle type, or leave as Any to see all.'),
    ).toBeInTheDocument();
    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: 'Search rides' }));
    expect(sentParams().has('vehicleTypeId')).toBe(false);
    expect(sentParams().has('maxFareShare')).toBe(false);
  });

  it('offers a saved share that is not one of the usual amounts', () => {
    render(
      <SearchRideForm options={options} defaults={{ vehicleTypeId: null, maxFareShare: 120 }} />,
    );
    expect(screen.getByLabelText('Maximum fare share')).toHaveValue('120');
    expect(screen.getByRole('option', { name: '₹120' })).toBeInTheDocument();
  });

  it('ignores a saved vehicle type that is no longer offered', () => {
    render(
      <SearchRideForm
        options={options}
        defaults={{ vehicleTypeId: 'vikram', maxFareShare: null }}
      />,
    );
    expect(screen.getByLabelText('Vehicle type')).toHaveValue('');
    expect(
      screen.getByText('Filter by vehicle type, or leave as Any to see all.'),
    ).toBeInTheDocument();
  });
});
