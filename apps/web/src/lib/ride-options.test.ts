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
          { id: 'hall-1', name: 'Hall 1', detail: null, type: 'campus' },
          {
            id: 'kanpur-central',
            name: 'Kanpur Central',
            detail: 'Railway station',
            type: 'transport_hub',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'car', name: 'Car', capacity: 4 }] });

    await expect(getRideFormOptions()).resolves.toEqual({
      campusPlaces: [{ id: 'hall-1', name: 'Hall 1' }],
      hubs: [{ id: 'kanpur-central', name: 'Kanpur Central', detail: 'Railway station' }],
      vehicleTypes: [{ id: 'car', name: 'Car', capacity: 4 }],
    });
  });

  it('does not include inactive rows because the SQL filters them', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await expect(getRideFormOptions()).resolves.toEqual({
      campusPlaces: [],
      hubs: [],
      vehicleTypes: [],
    });

    expect(query.mock.calls[0][0]).toContain('is_active=true');
    expect(query.mock.calls[1][0]).toContain('is_active=true');
  });
});
