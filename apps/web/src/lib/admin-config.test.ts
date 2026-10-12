// @vitest-environment node
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  createLocation,
  createVehicleType,
  setCampusFare,
  setExternalFareRange,
  updateLocation,
  updateVehicleType,
} from './admin-config';

type Handler = (sql: string, params: unknown[]) => { rows: unknown[] } | undefined;

/** A transaction client whose answer to each query comes from `handler` (empty by default). */
function fakeClient(handler: Handler) {
  const query = vi.fn(
    async (sql: string, params: unknown[] = []) => handler(sql, params) ?? { rows: [] },
  );
  return { client: { query } as unknown as PoolClient, query };
}

const auto = { id: 'auto', name: 'Auto', capacity: 3, is_active: true, sort_order: 2, version: 4 };
const hub = {
  id: 'kanpur-central',
  type: 'transport_hub',
  name: 'Kanpur Central',
  detail: 'Railway station',
  is_active: true,
  sort_order: 1,
  version: 2,
};
const updatedAt = new Date('2026-10-11T10:00:00Z');

describe('vehicle types (OA-FR-01 to 03)', () => {
  it('adds one with an ID from its name, after the others', async () => {
    const { client, query } = fakeClient((sql) =>
      sql.includes('INSERT INTO vehicle_types')
        ? { rows: [{ ...auto, id: 'e-rickshaw', name: 'E-rickshaw', version: 1 }] }
        : undefined,
    );
    const write = await createVehicleType(client, { name: 'E-rickshaw', capacity: 4 });
    expect(write).toMatchObject({ kind: 'saved', before: null, record: { id: 'e-rickshaw' } });
    expect(query.mock.calls[0][1]).toEqual(['e-rickshaw', 'E-rickshaw', 4]);
  });

  it('refuses a name already taken, and a name with no Latin letter or digit', async () => {
    const { client } = fakeClient(() => undefined);
    await expect(createVehicleType(client, { name: 'Auto', capacity: 3 })).resolves.toMatchObject({
      kind: 'invalid',
      fields: { name: expect.stringContaining('already exists') },
    });
    await expect(createVehicleType(client, { name: 'ऑटो', capacity: 3 })).resolves.toMatchObject({
      kind: 'invalid',
      fields: { name: expect.stringContaining('Latin') },
    });
  });

  it('edits the version the admin loaded, and returns the one before for the audit', async () => {
    const { client, query } = fakeClient((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [auto] };
      if (sql.includes('UPDATE vehicle_types'))
        return { rows: [{ ...auto, capacity: 4, version: 5 }] };
    });
    const write = await updateVehicleType(client, 'auto', { capacity: 4, version: 4 });
    expect(write).toEqual({
      kind: 'saved',
      before: { id: 'auto', name: 'Auto', capacity: 3, isActive: true, sortOrder: 2, version: 4 },
      record: { id: 'auto', name: 'Auto', capacity: 4, isActive: true, sortOrder: 2, version: 5 },
    });
    expect(query.mock.calls[1][1]).toEqual(['auto', null, 4, null]);
  });

  it('refuses an edit of an older version, and shows the current one (SYS-NFR-04)', async () => {
    const { client, query } = fakeClient((sql) =>
      sql.includes('FOR UPDATE') ? { rows: [auto] } : undefined,
    );
    await expect(
      updateVehicleType(client, 'auto', { isActive: false, version: 3 }),
    ).resolves.toMatchObject({
      kind: 'version_conflict',
      current: { id: 'auto', version: 4 },
    });
    expect(query).toHaveBeenCalledOnce();
  });

  it('answers not found for an unknown ID', async () => {
    const { client } = fakeClient(() => undefined);
    await expect(updateVehicleType(client, 'jet', { version: 1 })).resolves.toEqual({
      kind: 'not_found',
    });
  });
});

describe('places (OA-FR-05 to 07)', () => {
  it('adds a hub after the other hubs', async () => {
    const { client, query } = fakeClient((sql) =>
      sql.includes('INSERT INTO locations')
        ? { rows: [{ ...hub, id: 'lucknow-airport', version: 1 }] }
        : undefined,
    );
    const write = await createLocation(client, {
      type: 'transport_hub',
      name: 'Lucknow Airport',
      detail: null,
    });
    expect(write).toMatchObject({
      kind: 'saved',
      record: { id: 'lucknow-airport', type: 'transport_hub' },
    });
    expect(query.mock.calls[0][1]).toEqual([
      'lucknow-airport',
      'transport_hub',
      'Lucknow Airport',
      null,
    ]);
  });

  it('refuses a name already taken', async () => {
    const { client } = fakeClient(() => undefined);
    await expect(
      createLocation(client, { type: 'campus', name: 'Hall 6', detail: null }),
    ).resolves.toMatchObject({
      kind: 'invalid',
      fields: { name: expect.stringContaining('already') },
    });
  });

  it('changes the detail only when it was sent, and can clear it', async () => {
    const { client, query } = fakeClient((sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [hub] };
      if (sql.includes('UPDATE locations')) return { rows: [{ ...hub, version: 3 }] };
    });
    await updateLocation(client, 'kanpur-central', { name: 'Kanpur Central', version: 2 });
    expect(query.mock.calls[1][1]).toEqual(['kanpur-central', 'Kanpur Central', false, null, null]);
    await updateLocation(client, 'kanpur-central', { detail: null, version: 2 });
    expect(query.mock.calls[3][1]).toEqual(['kanpur-central', null, true, null, null]);
  });

  it('refuses an older version and an unknown place', async () => {
    const stale = fakeClient((sql) => (sql.includes('FOR UPDATE') ? { rows: [hub] } : undefined));
    await expect(
      updateLocation(stale.client, 'kanpur-central', { version: 1 }),
    ).resolves.toMatchObject({
      kind: 'version_conflict',
    });
    const missing = fakeClient(() => undefined);
    await expect(updateLocation(missing.client, 'nowhere', { version: 1 })).resolves.toEqual({
      kind: 'not_found',
    });
  });
});

const campusPlaces = {
  rows: [
    { id: 'hall-1', type: 'campus' },
    { id: 'hall-6', type: 'campus' },
  ],
};
const fareRow = {
  from_location_id: 'hall-1',
  to_location_id: 'hall-6',
  vehicle_type_id: 'auto',
  fare: 40,
  version: 1,
  updated_at: updatedAt,
};

function fareClient(existing: unknown[], places = campusPlaces, vehicle = [{ '?column?': 1 }]) {
  return fakeClient((sql) => {
    if (sql.includes('FROM locations')) return places;
    if (sql.includes('FROM vehicle_types')) return { rows: vehicle };
    if (sql.includes('FOR UPDATE')) return { rows: existing };
    if (sql.includes('INSERT INTO campus_fares'))
      return { rows: [{ ...fareRow, fare: 50, version: 2 }] };
    if (sql.includes('INSERT INTO external_fare_ranges')) {
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
    }
  });
}

const campusInput = { fromId: 'hall-1', toId: 'hall-6', vehicleTypeId: 'auto', fare: 50 };

describe('campus fares (OA-FR-10)', () => {
  it('sets a fare not set before, recording the admin', async () => {
    const { client, query } = fareClient([]);
    const write = await setCampusFare(client, { ...campusInput, version: null }, 'admin-1');
    expect(write).toMatchObject({ kind: 'saved', before: null, record: { fare: 50, version: 2 } });
    expect(query.mock.calls.at(-1)?.[1]).toEqual(['hall-1', 'hall-6', 'auto', 50, 'admin-1']);
  });

  it('changes the version the admin loaded', async () => {
    const { client } = fareClient([fareRow]);
    await expect(
      setCampusFare(client, { ...campusInput, version: 1 }, 'admin-1'),
    ).resolves.toMatchObject({
      kind: 'saved',
      before: { fare: 40, version: 1, updatedAt: updatedAt.toISOString() },
    });
  });

  it('is a conflict when another admin set it first, or changed it since', async () => {
    const { client } = fareClient([fareRow]);
    await expect(
      setCampusFare(client, { ...campusInput, version: null }, 'a'),
    ).resolves.toMatchObject({
      kind: 'version_conflict',
      current: { fare: 40 },
    });
    await expect(setCampusFare(client, { ...campusInput, version: 7 }, 'a')).resolves.toMatchObject(
      {
        kind: 'version_conflict',
      },
    );
    const gone = fareClient([]);
    await expect(setCampusFare(gone.client, { ...campusInput, version: 1 }, 'a')).resolves.toEqual({
      kind: 'not_found',
    });
  });

  it('names each place or vehicle type that is not usable', async () => {
    const { client } = fareClient([], { rows: [{ id: 'hall-1', type: 'transport_hub' }] }, []);
    await expect(setCampusFare(client, { ...campusInput, version: null }, 'a')).resolves.toEqual({
      kind: 'invalid',
      fields: {
        fromId: 'Choose a campus place from the list.',
        toId: 'Choose a campus place from the list.',
        vehicleTypeId: 'Choose a vehicle type from the list.',
      },
    });
  });
});

describe('external fare ranges (OA-FR-11, SYS-FR-12)', () => {
  const input = { hubId: 'kanpur-central', vehicleTypeId: 'auto', minFare: 250, maxFare: 400 };

  it('sets a range from a hub', async () => {
    const { client } = fareClient([], { rows: [{ id: 'kanpur-central', type: 'transport_hub' }] });
    await expect(
      setExternalFareRange(client, { ...input, version: null }, 'a'),
    ).resolves.toMatchObject({
      kind: 'saved',
      record: { hubId: 'kanpur-central', minFare: 250, maxFare: 400 },
    });
  });

  it('refuses a campus place in place of a hub, and a stale version', async () => {
    const wrong = fareClient([], { rows: [{ id: 'kanpur-central', type: 'campus' }] });
    await expect(
      setExternalFareRange(wrong.client, { ...input, version: null }, 'a'),
    ).resolves.toEqual({
      kind: 'invalid',
      fields: { hubId: 'Choose a hub from the list.' },
    });
    const existing = {
      hub_id: 'kanpur-central',
      vehicle_type_id: 'auto',
      min_fare: 200,
      max_fare: 350,
      version: 3,
      updated_at: updatedAt,
    };
    const stale = fareClient([existing], {
      rows: [{ id: 'kanpur-central', type: 'transport_hub' }],
    });
    await expect(
      setExternalFareRange(stale.client, { ...input, version: 2 }, 'a'),
    ).resolves.toMatchObject({
      kind: 'version_conflict',
      current: { minFare: 200, version: 3 },
    });
  });
});
