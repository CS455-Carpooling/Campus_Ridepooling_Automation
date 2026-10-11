import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationRecord } from '@/lib/admin-types';
import { PlacesEditor } from './PlacesEditor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const hub: LocationRecord = {
  id: 'kanpur-central',
  type: 'transport_hub',
  name: 'Kanpur Central',
  detail: 'Railway station',
  isActive: true,
  sortOrder: 1,
  version: 2,
};

const body = (call = 0) => JSON.parse(String(vi.mocked(fetch).mock.calls[call][1]?.body));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlacesEditor (OA-FR-05 to 07, CS455-51)', () => {
  it('lists hubs with their detail line, and says what deactivating one does', async () => {
    render(<PlacesEditor type="transport_hub" initial={[hub]} />);
    expect(screen.getByRole('heading', { name: 'Transport hubs' })).toBeInTheDocument();
    expect(screen.getByText('Railway station')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate Kanpur Central' }));
    expect(screen.getByRole('region', { name: 'Deactivate Kanpur Central?' })).toHaveTextContent(
      'Riders will no longer be able to offer or find rides to or from it.',
    );
  });

  it('clears a detail line by sending null, and never sends a type', async () => {
    render(<PlacesEditor type="transport_hub" initial={[hub]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Kanpur Central' }));
    const form = within(screen.getByRole('form', { name: 'Edit Kanpur Central' }));
    await userEvent.clear(form.getByLabelText('Detail line'));
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ location: { ...hub, detail: null, version: 3 } }),
    );
    await userEvent.click(form.getByRole('button', { name: 'Save changes' }));
    expect(body()).toEqual({ name: 'Kanpur Central', detail: null, version: 2 });
    expect(await screen.findByText('No detail line')).toBeInTheDocument();
  });

  it('adds a campus pickup point of its own type', async () => {
    render(<PlacesEditor type="campus" initial={[]} />);
    expect(screen.getByText('None yet. Add the first one below.')).toBeInTheDocument();
    const form = within(screen.getByRole('form', { name: 'Add a campus pickup point' }));
    await userEvent.type(form.getByLabelText('Name'), 'Hall 15');
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        {
          location: {
            ...hub,
            id: 'hall-15',
            type: 'campus',
            name: 'Hall 15',
            detail: null,
            version: 1,
          },
        },
        { status: 201 },
      ),
    );
    await userEvent.click(form.getByRole('button', { name: 'Add campus pickup point' }));
    expect(body()).toEqual({ type: 'campus', name: 'Hall 15', detail: null });
    expect(await screen.findByRole('button', { name: 'Edit Hall 15' })).toBeInTheDocument();
  });
});
