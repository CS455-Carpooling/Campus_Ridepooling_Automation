import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUpcomingRides = vi.hoisted(() => vi.fn());
const getHistoricalRides = vi.hoisted(() => vi.fn());
vi.mock('./ride-view', () => ({ getUpcomingRides, getHistoricalRides }));

import { getAdminHome, getStudentHome } from './home-data';

beforeEach(() => {
  getUpcomingRides.mockReset();
  getHistoricalRides.mockReset();
});

describe('home data', () => {
  it('loads upcoming and historical rides for the dashboard', async () => {
    const ride = {
      rideId: 'r1',
      title: 'To Kanpur Central',
      departure: '2026-10-10T01:00:00.000Z',
      part: 'owner',
      seatsLeft: 3,
      state: 'scheduled',
    };
    const pastRide = { rideId: 'r2', state: 'completed' };
    getUpcomingRides.mockResolvedValue([ride]);
    getHistoricalRides.mockResolvedValue([pastRide]);
    const now = new Date('2026-10-05T12:00:00Z');
    await expect(getStudentHome('u1', now)).resolves.toEqual({
      upcoming: [ride],
      history: [pastRide],
      waiting: [],
    });
    expect(getUpcomingRides).toHaveBeenCalledWith('u1', now);
    expect(getHistoricalRides).toHaveBeenCalledWith('u1', now);
  });

  it('marks every admin count as not available rather than zero', async () => {
    await expect(getAdminHome()).resolves.toEqual({
      openIncidents: null,
      complaintsToReview: null,
      recommendationsToDecide: null,
    });
  });
});
