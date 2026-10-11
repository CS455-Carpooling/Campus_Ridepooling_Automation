import 'server-only';
import { pool } from './db';

/** A place a ride starts or ends at. IDs are text codes stored in the database. */
export type Place = {
  id: string;
  name: string;
  /** A second line, for example "Railway station". */
  detail?: string;
};

export type VehicleType = {
  id: string;
  name: string;
  /** Everyone the vehicle carries, the ride owner included. */
  capacity: number;
};

/** The typical fare from a hub by vehicle type, set by the operations team (SYS-FR-12). */
export type FareRange = {
  hubId: string;
  vehicleTypeId: string;
  minFare: number;
  maxFare: number;
};

export type RideFormOptions = {
  /** Halls and Main Gate: where the owner and each rider are picked up or dropped. */
  campusPlaces: Place[];
  /** The fixed transport hubs a ride goes to or comes from. */
  hubs: Place[];
  vehicleTypes: VehicleType[];
  /** Shown as an estimate next to the fare (CS455-51); never a limit on it. */
  fareRanges?: FareRange[];
};

type LocationRow = {
  id: string;
  name: string;
  detail: string | null;
  type: 'campus' | 'transport_hub';
  sort_order: number;
};
type VehicleTypeRow = { id: string; name: string; capacity: number; sort_order: number };
type FareRangeRow = { hub_id: string; vehicle_type_id: string; min_fare: number; max_fare: number };

/**
 * The Create Ride form's authoritative options. Configuration is read from the
 * database so the UI never owns the location or vehicle-capacity lists.
 */
export async function getRideFormOptions(): Promise<RideFormOptions> {
  const [locations, vehicleTypes, fareRanges] = await Promise.all([
    pool.query<LocationRow>(
      `SELECT id,name,detail,type,sort_order
       FROM locations
       WHERE is_active=true
       ORDER BY type, sort_order`,
    ),
    pool.query<VehicleTypeRow>(
      `SELECT id,name,capacity,sort_order
       FROM vehicle_types
       WHERE is_active=true
       ORDER BY sort_order`,
    ),
    pool.query<FareRangeRow>(
      `SELECT f.hub_id, f.vehicle_type_id, f.min_fare, f.max_fare
       FROM external_fare_ranges f
       JOIN locations h ON h.id = f.hub_id AND h.is_active
       JOIN vehicle_types v ON v.id = f.vehicle_type_id AND v.is_active`,
    ),
  ]);

  return {
    campusPlaces: locations.rows
      .filter((place) => place.type === 'campus')
      .map(({ id, name, detail }) => ({ id, name, ...(detail ? { detail } : {}) })),
    hubs: locations.rows
      .filter((place) => place.type === 'transport_hub')
      .map(({ id, name, detail }) => ({ id, name, ...(detail ? { detail } : {}) })),
    vehicleTypes: vehicleTypes.rows.map(({ id, name, capacity }) => ({ id, name, capacity })),
    fareRanges: fareRanges.rows.map((row) => ({
      hubId: row.hub_id,
      vehicleTypeId: row.vehicle_type_id,
      minFare: row.min_fare,
      maxFare: row.max_fare,
    })),
  };
}
