import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationRecord, VehicleTypeRecord } from '@/lib/admin-types';
import { CampusFaresEditor } from './CampusFaresEditor';
import { FareRangesEditor } from './FareRangesEditor';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const place = (
  id: string,
  name: string,
  type: LocationRecord['type'],
  isActive = true,
): LocationRecord => ({
  id,
  type,
  name,
  detail: null,
  isActive,
  sortOrder: 1,
  version: 1,
});
const vehicle = (id: string, name: string, isActive = true): VehicleTypeRecord => ({
  id,
  name,
  capacity: 3,
  isActive,
  sortOrder: 1,
  version: 1,
});

const hubs = [
  place('kanpur-central', 'Kanpur Central', 'transport_hub'),
  place('old-stand', 'Old Stand', 'transport_hub', false),
];
const types = [vehicle('auto', 'Auto'), vehicle('vikram', 'Vikram', false)];
const campus = [place('hall-1', 'Hall 1', 'campus'), place('hall-6', 'Hall 6', 'campus')];
const updatedAt = '2026-10-11T10:00:00.000Z';

const reply = (status: number, body: object) =>
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(body, { status }));
const body = (call = 0) => JSON.parse(String(vi.mocked(fetch).mock.calls[call][1]?.body));

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FareRangesEditor (OA-FR-11, SYS-FR-12, CS455-51)', () => {
  it('lists active hubs by active vehicle type, with what is set', () => {
    render(
      <FareRangesEditor
        hubs={hubs}
        vehicleTypes={types}
        ranges={[
          {
            hubId: 'kanpur-central',
            vehicleTypeId: 'auto',
            minFare: 250,
            maxFare: 400,
            version: 2,
            updatedAt,
          },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Kanpur Central' })).toBeInTheDocument();
    expect(screen.queryByText('Old Stand')).not.toBeInTheDocument();
    expect(screen.queryByText('Vikram')).not.toBeInTheDocument();
    const row = within(screen.getByRole('form', { name: 'Auto from Kanpur Central' }));
    expect(row.getByText('Now ₹250 to ₹400')).toBeInTheDocument();
    expect(row.getByLabelText('Lowest (₹)')).toHaveValue('250');
  });

  it('sets a range not set yet with version null, then edits it with its version', async () => {
    render(<FareRangesEditor hubs={hubs} vehicleTypes={types} ranges={[]} />);
    const row = within(screen.getByRole('form', { name: 'Auto from Kanpur Central' }));
    expect(row.getByText('Not set yet')).toBeInTheDocument();
    await userEvent.type(row.getByLabelText('Lowest (₹)'), '250');
    await userEvent.type(row.getByLabelText('Highest (₹)'), '400');
    reply(200, {
      range: {
        hubId: 'kanpur-central',
        vehicleTypeId: 'auto',
        minFare: 250,
        maxFare: 400,
        version: 1,
        updatedAt,
      },
    });
    await userEvent.click(row.getByRole('button', { name: 'Save Auto from Kanpur Central' }));
    expect(body()).toEqual({
      hubId: 'kanpur-central',
      vehicleTypeId: 'auto',
      minFare: 250,
      maxFare: 400,
      version: null,
    });
    expect(await row.findByText('Saved.')).toBeInTheDocument();
    expect(row.getByText('Now ₹250 to ₹400')).toBeInTheDocument();

    await userEvent.clear(row.getByLabelText('Highest (₹)'));
    await userEvent.type(row.getByLabelText('Highest (₹)'), '450');
    reply(200, {
      range: {
        hubId: 'kanpur-central',
        vehicleTypeId: 'auto',
        minFare: 250,
        maxFare: 450,
        version: 2,
        updatedAt,
      },
    });
    await userEvent.click(row.getByRole('button', { name: 'Save Auto from Kanpur Central' }));
    expect(body(1).version).toBe(1);
  });

  it('refuses a range whose lowest fare is above its highest, before sending', async () => {
    render(<FareRangesEditor hubs={hubs} vehicleTypes={types} ranges={[]} />);
    const row = within(screen.getByRole('form', { name: 'Auto from Kanpur Central' }));
    await userEvent.type(row.getByLabelText('Lowest (₹)'), '500');
    await userEvent.type(row.getByLabelText('Highest (₹)'), '400');
    await userEvent.click(row.getByRole('button', { name: 'Save Auto from Kanpur Central' }));
    expect(row.getByText('The lowest fare must not be above the highest.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows another admin's range on a conflict and saves over it with its version", async () => {
    render(<FareRangesEditor hubs={hubs} vehicleTypes={types} ranges={[]} />);
    const row = within(screen.getByRole('form', { name: 'Auto from Kanpur Central' }));
    await userEvent.type(row.getByLabelText('Lowest (₹)'), '250');
    await userEvent.type(row.getByLabelText('Highest (₹)'), '400');
    reply(409, {
      error: 'Conflict',
      code: 'version_conflict',
      current: {
        hubId: 'kanpur-central',
        vehicleTypeId: 'auto',
        minFare: 300,
        maxFare: 500,
        version: 1,
        updatedAt,
      },
    });
    await userEvent.click(row.getByRole('button', { name: 'Save Auto from Kanpur Central' }));
    expect(await row.findByRole('alert')).toHaveTextContent(
      'Someone else set this to ₹300 to ₹500 meanwhile.',
    );
    expect(row.getByLabelText('Lowest (₹)')).toHaveValue('250');
    reply(200, {
      range: {
        hubId: 'kanpur-central',
        vehicleTypeId: 'auto',
        minFare: 250,
        maxFare: 400,
        version: 2,
        updatedAt,
      },
    });
    await userEvent.click(row.getByRole('button', { name: 'Save Auto from Kanpur Central' }));
    expect(body(1).version).toBe(1);
  });

  it('says what to do when there is no active hub or vehicle type', () => {
    render(<FareRangesEditor hubs={[]} vehicleTypes={types} ranges={[]} />);
    expect(screen.getByText('Add an active hub and vehicle type first.')).toBeInTheDocument();
  });

  it('sends someone whose session ended to sign in, and shows other refusals', async () => {
    render(<FareRangesEditor hubs={hubs} vehicleTypes={types} ranges={[]} />);
    const row = within(screen.getByRole('form', { name: 'Auto from Kanpur Central' }));
    await userEvent.type(row.getByLabelText('Lowest (₹)'), '250');
    await userEvent.type(row.getByLabelText('Highest (₹)'), '400');
    reply(401, { error: 'Authentication required.', code: 'unauthenticated' });
    await userEvent.click(row.getByRole('button', { name: 'Save Auto from Kanpur Central' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    reply(400, {
      error: 'Check the highlighted fields.',
      code: 'invalid',
      fields: { hubId: 'Choose a hub from the list.' },
    });
    await userEvent.click(row.getByRole('button', { name: 'Save Auto from Kanpur Central' }));
    expect(await row.findByText('Check the highlighted fields.')).toBeInTheDocument();
  });
});

describe('CampusFaresEditor (OA-FR-10, CS455-51)', () => {
  const fare = {
    fromId: 'hall-1',
    toId: 'hall-6',
    vehicleTypeId: 'auto',
    fare: 40,
    version: 3,
    updatedAt,
  };

  it('lists set fares by name, and edits one with its version', async () => {
    render(<CampusFaresEditor places={campus} vehicleTypes={types} fares={[fare]} />);
    expect(screen.getByRole('list', { name: 'Campus fares' })).toHaveTextContent(
      'Hall 1 and Hall 6 by Auto: ₹40',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit Hall 1 and Hall 6 by Auto' }));
    expect(screen.getByLabelText('Between')).toHaveFocus();
    expect(screen.getByLabelText('Fare (₹)')).toHaveValue('40');
    await userEvent.clear(screen.getByLabelText('Fare (₹)'));
    await userEvent.type(screen.getByLabelText('Fare (₹)'), '45');
    reply(200, { fare: { ...fare, fare: 45, version: 4 } });
    await userEvent.click(screen.getByRole('button', { name: 'Save fare' }));
    expect(body()).toEqual({
      fromId: 'hall-1',
      toId: 'hall-6',
      vehicleTypeId: 'auto',
      fare: 45,
      version: 3,
    });
    expect(await screen.findByText('Saved: Hall 1 and Hall 6 by Auto, ₹45.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Campus fares' })).toHaveTextContent('₹45');
  });

  it('sets a new fare with either place first, and refuses the same place twice', async () => {
    render(<CampusFaresEditor places={campus} vehicleTypes={types} fares={[]} />);
    expect(screen.getByText('No campus fares set yet.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Between'), 'hall-6');
    await userEvent.selectOptions(screen.getByLabelText('And'), 'hall-6');
    await userEvent.selectOptions(screen.getByLabelText('Vehicle type'), 'auto');
    await userEvent.type(screen.getByLabelText('Fare (₹)'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Save fare' }));
    expect(screen.getByText('Choose two different campus places.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText('And'), 'hall-1');
    reply(200, { fare: { ...fare, version: 1 } });
    await userEvent.click(screen.getByRole('button', { name: 'Save fare' }));
    expect(body()).toEqual({
      fromId: 'hall-1',
      toId: 'hall-6',
      vehicleTypeId: 'auto',
      fare: 40,
      version: null,
    });
    expect(await screen.findByRole('list', { name: 'Campus fares' })).toHaveTextContent(
      'Hall 1 and Hall 6 by Auto: ₹40',
    );
  });

  it("shows another admin's fare on a conflict, and other refusals", async () => {
    render(<CampusFaresEditor places={campus} vehicleTypes={types} fares={[fare]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Hall 1 and Hall 6 by Auto' }));
    reply(409, {
      error: 'Conflict',
      code: 'version_conflict',
      current: { ...fare, fare: 50, version: 4 },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save fare' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone else set this fare to ₹50 meanwhile.',
    );
    expect(screen.getByRole('list', { name: 'Campus fares' })).toHaveTextContent('₹50');

    reply(500, {
      error: 'The change could not be saved, so nothing was changed.',
      code: 'server_error',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save fare' }));
    expect(body(1).version).toBe(4);
    expect(
      await screen.findByText('The change could not be saved, so nothing was changed.'),
    ).toBeInTheDocument();

    reply(401, { error: 'Authentication required.', code: 'unauthenticated' });
    await userEvent.click(screen.getByRole('button', { name: 'Save fare' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});
