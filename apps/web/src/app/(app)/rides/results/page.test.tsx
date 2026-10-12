import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  searchRides: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: h.getCurrentUser }));
vi.mock('@/lib/ride-search', () => ({ searchRides: h.searchRides }));

import RideResultsPage from './page';

const USER_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const valid = {
  direction: 'to_hub',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-6',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
};

const open = (params: Record<string, string>) =>
  RideResultsPage({ searchParams: Promise.resolve(params) });

beforeEach(() => {
  vi.clearAllMocks();
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.searchRides.mockResolvedValue([]);
});

describe('/rides/results', () => {
  it('sends someone signed out to sign in', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    await expect(open(valid)).rejects.toThrow('redirect:/login');
  });

  it('searches with the filters from the URL', async () => {
    render(await open({ ...valid, vehicleTypeId: 'auto', maxFareShare: '150' }));
    expect(h.searchRides).toHaveBeenCalledWith(USER_ID, {
      ...valid,
      vehicleTypeId: 'auto',
      maxFareShare: 150,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'No rides found' })).toBeInTheDocument();
  });

  it('goes back to the search form for an invalid date, without querying', async () => {
    await expect(open({ ...valid, departureStart: '2026-13-45T06:30:00+05:30' })).rejects.toThrow(
      'redirect:/rides',
    );
    expect(h.searchRides).not.toHaveBeenCalled();
  });

  it('goes back to the search form when a filter is missing', async () => {
    await expect(open({ direction: 'to_hub' })).rejects.toThrow('redirect:/rides');
    expect(h.searchRides).not.toHaveBeenCalled();
  });
});
