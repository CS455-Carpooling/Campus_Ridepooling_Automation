// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { getConfiguration } from './admin-config-queries';

const updatedAt = new Date('2026-10-11T10:00:00Z');

describe('getConfiguration (CS455-51)', () => {
  it('reads every list, inactive items included, and splits places into hubs and campus', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM vehicle_types')) {
        return {
          rows: [
            { id: 'auto', name: 'Auto', capacity: 3, is_active: true, sort_order: 1, version: 1 },
          ],
        };
      }
      if (sql.includes('FROM locations')) {
        return {
          rows: [
            {
              id: 'kanpur-central',
              type: 'transport_hub',
              name: 'Kanpur Central',
              detail: 'Railway station',
              is_active: true,
              sort_order: 1,
              version: 2,
            },
            {
              id: 'hall-6',
              type: 'campus',
              name: 'Hall 6',
              detail: null,
              is_active: false,
              sort_order: 6,
              version: 1,
            },
          ],
        };
      }
      return {
        rows: [
          {
            hub_id: 'kanpur-central',
            vehicle_type_id: 'auto',
            min_fare: 250,
            max_fare: 400,
            version: 1,
            updated_at: updatedAt,
          },
        ],
      };
    });

    const data = await getConfiguration();
    expect(data.vehicleTypes).toEqual([
      { id: 'auto', name: 'Auto', capacity: 3, isActive: true, sortOrder: 1, version: 1 },
    ]);
    expect(data.hubs.map((hub) => hub.id)).toEqual(['kanpur-central']);
    expect(data.campusPlaces).toEqual([
      {
        id: 'hall-6',
        type: 'campus',
        name: 'Hall 6',
        detail: null,
        isActive: false,
        sortOrder: 6,
        version: 1,
      },
    ]);
    expect(data.externalFareRanges[0]).toMatchObject({
      hubId: 'kanpur-central',
      minFare: 250,
      maxFare: 400,
    });
    expect(String(query.mock.calls[0][0])).not.toContain('WHERE');
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toContain('campus_fares');
  });
});
