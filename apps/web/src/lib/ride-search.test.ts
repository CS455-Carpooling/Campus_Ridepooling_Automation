// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('./db', () => ({
  pool: { query: h.query },
}));

import { searchRides, type SearchRideRequest } from './ride-search';

const validRequest: SearchRideRequest = {
  direction: 'to_hub',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-6',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
};

const mockRideRow = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  direction: 'to_hub',
  hub_name: 'Kanpur Central',
  hub_detail: 'Railway station',
  campus_location_name: 'Hall 6',
  departure_start: new Date('2099-10-10T06:30:00+05:30'),
  departure_end: new Date('2099-10-10T07:30:00+05:30'),
  vehicle_name: 'Car',
  capacity_snapshot: 4,
  expected_total_fare: 400,
  occupant_count: 1,
  seats_left: 3,
  owner_name: 'Rahul Sharma',
};

const mockOccupantRow = {
  ride_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  display_name: 'Rahul Sharma',
  is_owner: true,
};

describe('searchRides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for non-uuid viewerId', async () => {
    const result = await searchRides('invalid-uuid', validRequest);
    expect(result).toEqual([]);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('returns matching search results with estimated share', async () => {
    h.query
      .mockResolvedValueOnce({ rows: [mockRideRow] })
      .mockResolvedValueOnce({ rows: [mockOccupantRow] });

    const results = await searchRides('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', validRequest);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      direction: 'to_hub',
      ownerName: 'Rahul Sharma',
      occupantNames: ['Rahul Sharma'],
      hub: { name: 'Kanpur Central', detail: 'Railway station' },
      campusLocationName: 'Hall 6',
      departureStart: mockRideRow.departure_start.toISOString(),
      departureEnd: mockRideRow.departure_end.toISOString(),
      vehicleName: 'Car',
      capacity: 4,
      occupantCount: 1,
      seatsLeft: 3,
      totalFare: 400,
      estimatedShare: 200, // ceil(400 / 2)
    });
  });

  it('returns empty array when no rides match', async () => {
    h.query.mockResolvedValueOnce({ rows: [] });

    const results = await searchRides('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', validRequest);

    expect(results).toEqual([]);
    expect(h.query).toHaveBeenCalledTimes(1);
  });
});
