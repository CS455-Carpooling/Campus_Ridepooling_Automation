import 'server-only';
import {
  EXTERNAL_FARE_COLUMNS,
  externalFareRangeRecord,
  LOCATION_COLUMNS,
  locationRecord,
  VEHICLE_TYPE_COLUMNS,
  vehicleTypeRecord,
} from './admin-config';
import type { ExternalFareRangeRecord, LocationRecord, VehicleTypeRecord } from './admin-types';
import { pool } from './db';

/** Everything an operations admin configures (CS455-51), inactive items included. */
export type ConfigurationData = {
  vehicleTypes: VehicleTypeRecord[];
  hubs: LocationRecord[];
  campusPlaces: LocationRecord[];
  externalFareRanges: ExternalFareRangeRecord[];
};

/**
 * The configuration pages' data, read in one go: active items first, each list in the order
 * the ride forms show it.
 */
export async function getConfiguration(): Promise<ConfigurationData> {
  const [vehicleTypes, locations, ranges] = await Promise.all([
    pool.query(
      `SELECT ${VEHICLE_TYPE_COLUMNS} FROM vehicle_types ORDER BY is_active DESC, sort_order, id`,
    ),
    pool.query(`SELECT ${LOCATION_COLUMNS} FROM locations ORDER BY is_active DESC, sort_order, id`),
    pool.query(
      `SELECT ${EXTERNAL_FARE_COLUMNS} FROM external_fare_ranges ORDER BY hub_id, vehicle_type_id`,
    ),
  ]);
  const places = locations.rows.map(locationRecord);
  return {
    vehicleTypes: vehicleTypes.rows.map(vehicleTypeRecord),
    hubs: places.filter((place) => place.type === 'transport_hub'),
    campusPlaces: places.filter((place) => place.type === 'campus'),
    externalFareRanges: ranges.rows.map(externalFareRangeRecord),
  };
}
