import 'server-only';
import type { PoolClient } from 'pg';
import {
  idFromName,
  type ExternalFareRangeInput,
  type LocationCreate,
  type LocationType,
  type LocationUpdate,
  type VehicleTypeCreate,
  type VehicleTypeUpdate,
} from './admin-config-rules';
import type { ExternalFareRangeRecord, LocationRecord, VehicleTypeRecord } from './admin-types';

/**
 * The configuration writes of the admin APIs (OA-FR-01 to 09, OA-FR-11, CS455-50). Each runs
 * on the transaction of withAdminAction(), which audits it. An edit names the version the admin
 * loaded and is refused when someone has changed the item since (SYS-NFR-04, 05). IDs never
 * change, and nothing is deleted: a vehicle type or place is deactivated instead, so the rides
 * that use it keep it (OA-FR-06).
 */

/** What a write did: saved (with the item before, for the audit), or why not. */
export type ConfigWrite<T> =
  | { kind: 'saved'; record: T; before: T | null }
  | { kind: 'not_found' }
  | { kind: 'version_conflict'; current: T }
  | { kind: 'invalid'; fields: Record<string, string> };

type VehicleTypeRow = {
  id: string;
  name: string;
  capacity: number;
  is_active: boolean;
  sort_order: number;
  version: number;
};

type LocationRow = {
  id: string;
  type: LocationType;
  name: string;
  detail: string | null;
  is_active: boolean;
  sort_order: number;
  version: number;
};

type ExternalFareRangeRow = {
  hub_id: string;
  vehicle_type_id: string;
  min_fare: number;
  max_fare: number;
  version: number;
  updated_at: Date;
};

export const VEHICLE_TYPE_COLUMNS = 'id, name, capacity, is_active, sort_order, version';
export const LOCATION_COLUMNS = 'id, type, name, detail, is_active, sort_order, version';
export const EXTERNAL_FARE_COLUMNS =
  'hub_id, vehicle_type_id, min_fare, max_fare, version, updated_at';

export const vehicleTypeRecord = (row: VehicleTypeRow): VehicleTypeRecord => ({
  id: row.id,
  name: row.name,
  capacity: row.capacity,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  version: row.version,
});

export const locationRecord = (row: LocationRow): LocationRecord => ({
  id: row.id,
  type: row.type,
  name: row.name,
  detail: row.detail,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  version: row.version,
});

export const externalFareRangeRecord = (row: ExternalFareRangeRow): ExternalFareRangeRecord => ({
  hubId: row.hub_id,
  vehicleTypeId: row.vehicle_type_id,
  minFare: row.min_fare,
  maxFare: row.max_fare,
  version: row.version,
  updatedAt: row.updated_at.toISOString(),
});

const NO_LATIN_NAME =
  'Use at least one Latin letter or digit in the name, so it can be given an ID.';

export async function createVehicleType(
  client: PoolClient,
  input: VehicleTypeCreate,
): Promise<ConfigWrite<VehicleTypeRecord>> {
  const id = idFromName(input.name);
  if (!id) return { kind: 'invalid', fields: { name: NO_LATIN_NAME } };
  const { rows } = await client.query<VehicleTypeRow>(
    `INSERT INTO vehicle_types (id, name, capacity, sort_order)
     SELECT $1, $2, $3, COALESCE(max(sort_order), 0) + 1 FROM vehicle_types
     ON CONFLICT (id) DO NOTHING
     RETURNING ${VEHICLE_TYPE_COLUMNS}`,
    [id, input.name, input.capacity],
  );
  if (rows.length === 0) {
    return { kind: 'invalid', fields: { name: 'A vehicle type with this name already exists.' } };
  }
  return { kind: 'saved', record: vehicleTypeRecord(rows[0]), before: null };
}

/** A capacity change applies to new rides only: each ride keeps its capacity_snapshot. */
export async function updateVehicleType(
  client: PoolClient,
  id: string,
  update: VehicleTypeUpdate,
): Promise<ConfigWrite<VehicleTypeRecord>> {
  const { rows } = await client.query<VehicleTypeRow>(
    `SELECT ${VEHICLE_TYPE_COLUMNS} FROM vehicle_types WHERE id = $1 FOR UPDATE`,
    [id],
  );
  if (rows.length === 0) return { kind: 'not_found' };
  const before = vehicleTypeRecord(rows[0]);
  if (before.version !== update.version) return { kind: 'version_conflict', current: before };
  const { rows: saved } = await client.query<VehicleTypeRow>(
    `UPDATE vehicle_types
     SET name = COALESCE($2, name), capacity = COALESCE($3, capacity),
         is_active = COALESCE($4, is_active), version = version + 1
     WHERE id = $1
     RETURNING ${VEHICLE_TYPE_COLUMNS}`,
    [id, update.name ?? null, update.capacity ?? null, update.isActive ?? null],
  );
  return { kind: 'saved', record: vehicleTypeRecord(saved[0]), before };
}

export async function createLocation(
  client: PoolClient,
  input: LocationCreate,
): Promise<ConfigWrite<LocationRecord>> {
  const id = idFromName(input.name);
  if (!id) return { kind: 'invalid', fields: { name: NO_LATIN_NAME } };
  const { rows } = await client.query<LocationRow>(
    `INSERT INTO locations (id, type, name, detail, sort_order)
     SELECT $1, $2, $3, $4, COALESCE(max(sort_order), 0) + 1 FROM locations WHERE type = $2
     ON CONFLICT (id) DO NOTHING
     RETURNING ${LOCATION_COLUMNS}`,
    [id, input.type, input.name, input.detail],
  );
  if (rows.length === 0) {
    return { kind: 'invalid', fields: { name: 'A place with this name already exists.' } };
  }
  return { kind: 'saved', record: locationRecord(rows[0]), before: null };
}

/** The type of a place never changes: rides already use it as a hub or as a pickup point. */
export async function updateLocation(
  client: PoolClient,
  id: string,
  update: LocationUpdate,
): Promise<ConfigWrite<LocationRecord>> {
  const { rows } = await client.query<LocationRow>(
    `SELECT ${LOCATION_COLUMNS} FROM locations WHERE id = $1 FOR UPDATE`,
    [id],
  );
  if (rows.length === 0) return { kind: 'not_found' };
  const before = locationRecord(rows[0]);
  if (before.version !== update.version) return { kind: 'version_conflict', current: before };
  const { rows: saved } = await client.query<LocationRow>(
    `UPDATE locations
     SET name = COALESCE($2, name),
         detail = CASE WHEN $3 THEN $4 ELSE detail END,
         is_active = COALESCE($5, is_active), version = version + 1
     WHERE id = $1
     RETURNING ${LOCATION_COLUMNS}`,
    [
      id,
      update.name ?? null,
      update.detail !== undefined,
      update.detail ?? null,
      update.isActive ?? null,
    ],
  );
  return { kind: 'saved', record: locationRecord(saved[0]), before };
}

/** The places and vehicle type a fare names must exist, and be of the right kind. */
async function checkFareIds(
  client: PoolClient,
  places: Array<{ field: string; id: string; type: LocationType }>,
  vehicleTypeId: string,
): Promise<Record<string, string>> {
  const { rows } = await client.query<{ id: string; type: LocationType }>(
    'SELECT id, type FROM locations WHERE id = ANY($1::text[])',
    [places.map((place) => place.id)],
  );
  const typeOf = new Map(rows.map((row) => [row.id, row.type]));
  const fields: Record<string, string> = {};
  for (const place of places) {
    if (typeOf.get(place.id) !== place.type) {
      fields[place.field] =
        place.type === 'campus'
          ? 'Choose a campus place from the list.'
          : 'Choose a hub from the list.';
    }
  }
  const vehicle = await client.query('SELECT 1 FROM vehicle_types WHERE id = $1', [vehicleTypeId]);
  if (vehicle.rows.length === 0) fields.vehicleTypeId = 'Choose a vehicle type from the list.';
  return fields;
}

/**
 * Sets the typical fare range from a hub for a vehicle type (OA-FR-11). Riders see it only as
 * an estimate (SYS-FR-12); no admin route sets the fare of an actual trip (SYS-FR-13).
 */
export async function setExternalFareRange(
  client: PoolClient,
  input: ExternalFareRangeInput,
  adminId: string,
): Promise<ConfigWrite<ExternalFareRangeRecord>> {
  const fields = await checkFareIds(
    client,
    [{ field: 'hubId', id: input.hubId, type: 'transport_hub' }],
    input.vehicleTypeId,
  );
  if (Object.keys(fields).length > 0) return { kind: 'invalid', fields };

  const key = [input.hubId, input.vehicleTypeId];
  const { rows } = await client.query<ExternalFareRangeRow>(
    `SELECT ${EXTERNAL_FARE_COLUMNS} FROM external_fare_ranges
     WHERE hub_id = $1 AND vehicle_type_id = $2
     FOR UPDATE`,
    key,
  );
  const before = rows[0] ? externalFareRangeRecord(rows[0]) : null;
  if (before ? before.version !== input.version : input.version !== null) {
    return before ? { kind: 'version_conflict', current: before } : { kind: 'not_found' };
  }
  const { rows: saved } = await client.query<ExternalFareRangeRow>(
    `INSERT INTO external_fare_ranges (hub_id, vehicle_type_id, min_fare, max_fare, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (hub_id, vehicle_type_id) DO UPDATE
       SET min_fare = EXCLUDED.min_fare, max_fare = EXCLUDED.max_fare,
           updated_by = EXCLUDED.updated_by,
           version = external_fare_ranges.version + 1, updated_at = now()
     RETURNING ${EXTERNAL_FARE_COLUMNS}`,
    [...key, input.minFare, input.maxFare, adminId],
  );
  return { kind: 'saved', record: externalFareRangeRecord(saved[0]), before };
}
