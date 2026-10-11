import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { getRideFormOptions } from './ride-options';

beforeEach(() => query.mockReset());

describe('getRideFormOptions', () => {
  it('reads active campus places, hubs and vehicle types from the database', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          { id: 'hall-1', name: 'Hall 1', detail: null, type: 'campus', sort_order: 1 },
          {
            id: 'kanpur-central',
            name: 'Kanpur Central',
            detail: 'Railway station',
            type: 'transport_hub',
            sort_order: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'car', name: 'Car', capacity: 4, sort_order: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ hub_id: 'kanpur-central', vehicle_type_id: 'car', min_fare: 450, max_fare: 700 }],
      });

    await expect(getRideFormOptions()).resolves.toEqual({
      campusPlaces: [{ id: 'hall-1', name: 'Hall 1' }],
      hubs: [{ id: 'kanpur-central', name: 'Kanpur Central', detail: 'Railway station' }],
      vehicleTypes: [{ id: 'car', name: 'Car', capacity: 4 }],
      fareRanges: [{ hubId: 'kanpur-central', vehicleTypeId: 'car', minFare: 450, maxFare: 700 }],
    });
  });

  it('does not include inactive rows because the SQL filters them', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(getRideFormOptions()).resolves.toEqual({
      campusPlaces: [],
      hubs: [],
      vehicleTypes: [],
      fareRanges: [],
    });

    expect(query.mock.calls[0][0]).toContain('ORDER BY type, sort_order');
    expect(query.mock.calls[1][0]).toContain('ORDER BY sort_order');
    // Ranges only for hubs and vehicle types that can still be chosen (CS455-51).
    expect(query.mock.calls[2][0]).toContain('h.is_active');
    expect(query.mock.calls[2][0]).toContain('v.is_active');
  });
});
