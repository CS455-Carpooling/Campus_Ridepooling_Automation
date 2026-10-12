import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VehicleTypeRecord } from '@/lib/admin-types';
import { VehicleTypesEditor } from './VehicleTypesEditor';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const auto: VehicleTypeRecord = {
  id: 'auto',
  name: 'Auto',
  capacity: 3,
  isActive: true,
  sortOrder: 1,
  version: 4,
};
const vikram: VehicleTypeRecord = {
  id: 'vikram',
  name: 'Vikram',
  capacity: 7,
  isActive: false,
  sortOrder: 3,
  version: 2,
};

const reply = (status: number, body: object) =>
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(body, { status }));
/** The open edit form for Auto. */
const editForm = () => within(screen.getByRole('form', { name: 'Edit Auto' }));
const sent = (call = 0) => {
  const [url, init] = vi.mocked(fetch).mock.calls[call];
  return { url, method: init?.method, body: JSON.parse(String(init?.body)) };
};

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderEditor() {
  render(<VehicleTypesEditor initial={[auto, vikram]} />);
  return within(screen.getByRole('list', { name: 'All vehicle types' }));
}

describe('VehicleTypesEditor (OA-FR-01 to 03, CS455-51)', () => {
  it('lists each vehicle type with its capacity and status', () => {
    const list = renderEditor();
    const [first, second] = list.getAllByRole('listitem');
    expect(first).toHaveTextContent('Auto');
    expect(first).toHaveTextContent('Carries 3 people, the owner included');
    expect(within(first).getByText('Active')).toBeInTheDocument();
    expect(within(second).getByText('Inactive')).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: 'Reactivate Vikram' })).toBeInTheDocument();
  });

  it('edits in place, sending the version it loaded, and shows the saved item', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Auto' }));
    expect(editForm().getByLabelText('Name')).toHaveFocus();
    await userEvent.clear(editForm().getByLabelText('Capacity'));
    await userEvent.type(editForm().getByLabelText('Capacity'), '4');
    reply(200, { vehicleType: { ...auto, capacity: 4, version: 5 } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(sent()).toEqual({
      url: '/api/admin/vehicle-types/auto',
      method: 'PATCH',
      body: { name: 'Auto', capacity: 4, version: 4 },
    });
    expect(await screen.findByText('Carries 4 people, the owner included')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved Auto.');
    expect(screen.getByRole('button', { name: 'Edit Auto' })).toHaveFocus();
  });

  it('checks the form before sending', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Auto' }));
    await userEvent.clear(editForm().getByLabelText('Capacity'));
    await userEvent.type(editForm().getByLabelText('Capacity'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(editForm().getByLabelText('Capacity')).toHaveAccessibleDescription(
      expect.stringContaining('Enter a capacity from 1 to 12 people.'),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the admin's input on a conflict, shows the other change, and saves over it on purpose", async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Auto' }));
    await userEvent.clear(editForm().getByLabelText('Name'));
    await userEvent.type(editForm().getByLabelText('Name'), 'Auto rickshaw');
    reply(409, {
      error: 'Someone else changed this.',
      code: 'version_conflict',
      current: { ...auto, capacity: 5, version: 6 },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Someone else changed this vehicle type meanwhile.');
    expect(alert).toHaveTextContent('It is now: Auto, carries 5 people, the owner included.');
    expect(editForm().getByLabelText('Name')).toHaveValue('Auto rickshaw');

    reply(200, { vehicleType: { ...auto, name: 'Auto rickshaw', capacity: 3, version: 7 } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(sent(1).body).toEqual({ name: 'Auto rickshaw', capacity: 3, version: 6 });
    expect(await screen.findByText('Auto rickshaw')).toBeInTheDocument();
  });

  it('shows the server messages next to the fields', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Auto' }));
    reply(400, {
      error: 'Check the highlighted fields.',
      code: 'invalid',
      fields: { name: 'That name is taken.' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('That name is taken.')).toBeInTheDocument();
  });

  it('deactivates only after a confirmation, and can cancel', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate Auto' }));
    const question = screen.getByRole('region', { name: 'Deactivate Auto?' });
    expect(question).toHaveFocus();
    expect(question).toHaveTextContent('Rides that already use it keep it.');
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }));
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate Auto' }));
    reply(200, { vehicleType: { ...auto, isActive: false, version: 5 } });
    await userEvent.click(screen.getByRole('button', { name: 'Yes, deactivate' }));
    expect(sent().body).toEqual({ isActive: false, version: 4 });
    expect(await screen.findByRole('button', { name: 'Reactivate Auto' })).toBeInTheDocument();
  });

  it('reactivates in one step, and shows a refusal on the row', async () => {
    renderEditor();
    reply(500, {
      error: 'The change could not be saved, so nothing was changed.',
      code: 'server_error',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate Vikram' }));
    expect(sent().body).toEqual({ isActive: true, version: 2 });
    expect(
      await screen.findByText('The change could not be saved, so nothing was changed.'),
    ).toBeInTheDocument();
  });

  it('adds a vehicle type, checking it first', async () => {
    renderEditor();
    const form = screen.getByRole('form', { name: 'Add a vehicle type' });
    await userEvent.click(within(form).getByRole('button', { name: 'Add vehicle type' }));
    expect(within(form).getByText('Enter a name of 2 to 40 characters.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.type(within(form).getByLabelText('Name'), 'E-rickshaw');
    await userEvent.type(within(form).getByLabelText('Capacity'), '4');
    reply(201, {
      vehicleType: {
        id: 'e-rickshaw',
        name: 'E-rickshaw',
        capacity: 4,
        isActive: true,
        sortOrder: 4,
        version: 1,
      },
    });
    await userEvent.click(within(form).getByRole('button', { name: 'Add vehicle type' }));
    expect(sent()).toEqual({
      url: '/api/admin/vehicle-types',
      method: 'POST',
      body: { name: 'E-rickshaw', capacity: 4 },
    });
    expect(await screen.findByRole('button', { name: 'Edit E-rickshaw' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Added E-rickshaw.');
    expect(within(form).getByLabelText('Name')).toHaveValue('');
  });

  it('sends someone whose session ended to sign in', async () => {
    renderEditor();
    reply(401, { error: 'Authentication required.', code: 'unauthenticated' });
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate Vikram' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });

  it('says when the connection failed', async () => {
    renderEditor();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate Vikram' }));
    expect(await screen.findByText(/Unable to reach the server/)).toBeInTheDocument();
  });
});
