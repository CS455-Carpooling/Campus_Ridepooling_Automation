import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchRideRequest, SearchRideResult } from '@/lib/ride-search';

const h = vi.hoisted(() => ({
  query: vi.fn(),
  searchRides: vi.fn(),
  enrichSharedInterests: vi.fn(),
  calculatePickupOrderImpact: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));
vi.mock('@/lib/ride-search', () => ({ searchRides: h.searchRides }));
vi.mock('./shared-interest-enrichment', () => ({ enrichSharedInterests: h.enrichSharedInterests }));
vi.mock('./pickup-order-impact', () => ({ calculatePickupOrderImpact: h.calculatePickupOrderImpact }));

import { rankRideRecommendations } from './recommendation-pipeline';

const filters: SearchRideRequest = {
  direction: 'to_hub',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-3',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
};

const ride: SearchRideResult = {
  id: 'ride-1',
  direction: 'to_hub',
  ownerName: 'Owner',
  occupantNames: ['Owner'],
  hub: { name: 'Kanpur Central', detail: 'Railway station' },
  campusLocationName: 'Hall 2',
  departureStart: '2099-10-10T06:40:00.000Z',
  departureEnd: '2099-10-10T07:10:00.000Z',
  vehicleName: 'Auto',
  capacity: 3,
  occupantCount: 1,
  seatsLeft: 2,
  totalFare: 300,
  estimatedShare: 150,
};

describe('rankRideRecommendations fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.searchRides.mockResolvedValue([ride]);
    h.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT name FROM locations')) return Promise.resolve({ rows: [{ name: 'Hall 3' }] });
      return Promise.resolve({ rows: [] });
    });
    h.enrichSharedInterests.mockResolvedValue(new Map([['ride-1', { sharedInterestTags: null }]]));
    h.calculatePickupOrderImpact.mockReturnValue(null);
  });

  it('returns current trusted ride details if the model fails', async () => {
    const response = await rankRideRecommendations('viewer-1', filters, async () => {
      throw new Error('Gemini unavailable');
    });
    expect(response.source).toBe('fallback');
    expect(response.suggestions).toHaveLength(1);
    expect(response.suggestions[0].ride).toEqual(ride);
    expect(response.suggestions[0].ride.estimatedShare).toBe(150);
    expect(response.suggestions[0].ride.seatsLeft).toBe(2);
    expect(h.searchRides).toHaveBeenCalledTimes(2);
  });

  it('falls back when the model returns only ineligible IDs', async () => {
    const response = await rankRideRecommendations('viewer-1', filters, async () => ({
      rankedRides: [{ rideId: 'not-eligible', factors: ['fare'], pros: [], cons: [] }],
    }));
    expect(response.source).toBe('fallback');
    expect(response.suggestions[0].ride.id).toBe('ride-1');
  });

  it('returns empty fallback when no eligible rides exist', async () => {
    h.searchRides.mockResolvedValue([]);
    const response = await rankRideRecommendations('viewer-1', filters, async () => ({
      rankedRides: [],
    }));
    expect(response).toEqual({
      source: 'fallback',
      suggestions: [],
      message: 'No eligible rides match these filters.',
    });
    expect(h.searchRides).toHaveBeenCalledTimes(1);
  });
});
