import { describe, expect, it } from 'vitest';
import type { SearchRideRequest, SearchRideResult } from '@/lib/ride-search';
import { departureWindowDistanceMinutes, rankFallbackRides } from './recommendation-pipeline';

const filters: SearchRideRequest = {
  direction: 'to_hub',
  hubId: 'hub',
  campusLocationId: 'hall-1',
  departureStart: '2026-10-10T10:00:00Z',
  departureEnd: '2026-10-10T11:00:00Z',
};

function ride(id: string, start: string, end: string, estimatedShare: number): SearchRideResult {
  return {
    id, direction: 'to_hub', ownerName: 'Owner', occupantNames: ['Owner'],
    hub: { name: 'Hub', detail: 'Station' }, campusLocationName: 'Hall 1',
    departureStart: start, departureEnd: end, vehicleName: 'Auto', capacity: 3,
    occupantCount: 1, seatsLeft: 2, totalFare: estimatedShare * 2, estimatedShare,
  };
}

describe('fallback departure-window ranking', () => {
  it('treats overlapping departure windows as zero distance', () => {
    expect(departureWindowDistanceMinutes(
      '2026-10-10T10:30:00Z', '2026-10-10T11:30:00Z',
      filters.departureStart, filters.departureEnd,
    )).toBe(0);
  });

  it('ranks overlapping windows ahead of a cheaper but distant window', () => {
    const distant = ride('a-cheap', '2026-10-10T12:00:00Z', '2026-10-10T12:30:00Z', 50);
    const overlapping = ride('z-overlap', '2026-10-10T10:30:00Z', '2026-10-10T11:30:00Z', 100);
    expect(rankFallbackRides([distant, overlapping], filters).map((x) => x.id))
      .toEqual(['z-overlap', 'a-cheap']);
  });

  it('uses estimated fare share to break equal departure-distance ties', () => {
    const dear = ride('dear', '2026-10-10T11:30:00Z', '2026-10-10T12:00:00Z', 180);
    const cheap = ride('cheap', '2026-10-10T11:30:00Z', '2026-10-10T12:00:00Z', 90);
    expect(rankFallbackRides([dear, cheap], filters).map((x) => x.id)).toEqual(['cheap', 'dear']);
  });

  it('uses ride ID as a stable final tie-breaker', () => {
    const z = ride('ride-z', '2026-10-10T10:30:00Z', '2026-10-10T11:30:00Z', 100);
    const a = ride('ride-a', '2026-10-10T10:30:00Z', '2026-10-10T11:30:00Z', 100);
    expect(rankFallbackRides([z, a], filters).map((x) => x.id)).toEqual(['ride-a', 'ride-z']);
  });
});
