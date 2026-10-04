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

export type RideFormOptions = {
  /** Halls and Main Gate: where the owner and each rider are picked up or dropped. */
  campusPlaces: Place[];
  /** The fixed transport hubs a ride goes to or comes from. */
  hubs: Place[];
  vehicleTypes: VehicleType[];
};

type LocationRow = {
  id: string;
  name: string;
  detail: string | null;
  type: 'campus' | 'transport_hub';
};
type VehicleTypeRow = { id: string; name: string; capacity: number };

/**
 * The Create Ride form's authoritative options. Configuration is read from the
 * database so the UI never owns the location or vehicle-capacity lists.
 */
export async function getRideFormOptions(): Promise<RideFormOptions> {
  const [locations, vehicleTypes] = await Promise.all([
    pool.query<LocationRow>(
      `SELECT id,name,detail,type
       FROM locations
       WHERE is_active=true
       ORDER BY type, id`,
    ),
    pool.query<VehicleTypeRow>(
      `SELECT id,name,capacity
       FROM vehicle_types
       WHERE is_active=true
       ORDER BY id`,
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
  };
}
