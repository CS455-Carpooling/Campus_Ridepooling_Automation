import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationRecord, VehicleTypeRecord } from '@/lib/admin-types';
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
