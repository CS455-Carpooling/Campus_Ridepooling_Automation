import { pool } from '@/lib/db';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { knownRideIds, rideMessages, validateRideRequest, type CreateRideRequest } from '@/lib/ride-rules';
import type { PoolClient } from 'pg';

const ACTIVE_RIDE_STATES = ['scheduled', 'pickup_in_progress', 'in_transit'] as const;

type LocationRow = { id: string; type: 'campus' | 'transport_hub' };
type VehicleTypeRow = { id: string; capacity: number };

type RideRow = {
  id: string;
  owner_id: string;
  direction: string;
  hub_id: string;
  vehicle_type_id: string;
  capacity_snapshot: number;
  departure_start: Date;
  departure_end: Date;
  expected_total_fare: number;
  state: string;
  created_at: Date;
};

const validationError = (errors: Record<string, string>) =>
  json({ error: 'Validation failed.', errors }, 400);

async function lookupActiveOptions(client: PoolClient, body: Record<string, unknown>) {
  const ids = [body.hubId, body.campusLocationId].filter(
    (id): id is string => typeof id === 'string',
  );
  const vehicleId = typeof body.vehicleTypeId === 'string' ? body.vehicleTypeId : null;

  const [locations, vehicles] = await Promise.all([
    client.query<LocationRow>(
      `SELECT id,type FROM locations
       WHERE is_active=true AND id=ANY($1::text[])
       FOR SHARE`,
      [ids],
    ),
    vehicleId
      ? client.query<VehicleTypeRow>(
          `SELECT id,capacity FROM vehicle_types
           WHERE is_active=true AND id=$1
           FOR SHARE`,
          [vehicleId],
        )
      : Promise.resolve({ rows: [] as VehicleTypeRow[] }),
  ]);

  return { locations: locations.rows, vehicles: vehicles.rows };
}

function semanticLocationErrors(
  body: Record<string, unknown>,
  locations: LocationRow[],
  vehicleTypes: VehicleTypeRow[],
) {
  const errors: Record<string, string> = {};
  const locationById = new Map(locations.map((row) => [row.id, row.type]));

  if (typeof body.hubId === 'string' && locationById.get(body.hubId) !== 'transport_hub') {
    errors.hubId = 'Choose an active transport hub.';
  }
  if (
    typeof body.campusLocationId === 'string' &&
    locationById.get(body.campusLocationId) !== 'campus'
  ) {
    errors.campusLocationId = 'Choose an active campus location.';
  }
  if (typeof body.vehicleTypeId === 'string' && vehicleTypes.length === 0) {
    errors.vehicleTypeId = 'Choose an active vehicle type.';
  }

  return errors;
}

async function createRide(
  client: PoolClient,
  userId: string,
  request: CreateRideRequest,
  capacity: number,
) {
  const owner = await client.query<{ id: string }>('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE', [
    userId,
  ]);
  if (owner.rows.length === 0) return { kind: 'unauthenticated' as const };

  const conflict = await client.query(
    `SELECT 1 FROM rides
     WHERE owner_id=$1
       AND state=ANY($4::text[])
       AND departure_start < $3
       AND departure_end > $2
     LIMIT 1`,
    [userId, request.departureStart, request.departureEnd, [...ACTIVE_RIDE_STATES]],
  );

  if (conflict.rows.length > 0) return { kind: 'conflict' as const };

  const ride = await client.query<RideRow>(
    `INSERT INTO rides
      (owner_id,direction,hub_id,vehicle_type_id,capacity_snapshot,departure_start,departure_end,expected_total_fare,state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled')
     RETURNING id,owner_id,direction,hub_id,vehicle_type_id,capacity_snapshot,
               departure_start,departure_end,expected_total_fare,state,created_at`,
    [
      userId,
      request.direction,
      request.hubId,
      request.vehicleTypeId,
      capacity,
      request.departureStart,
      request.departureEnd,
      request.expectedTotalFare,
    ],
  );

  await client.query(
    `INSERT INTO riders (ride_id,user_id,campus_location_id)
     VALUES ($1,$2,$3)`,
    [ride.rows[0].id, userId, request.campusLocationId],
  );

  return { kind: 'created' as const, ride: ride.rows[0] };
}

export async function POST(req: Request) {
  const blocked = await guard('create-ride', 20, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const body = await readJson(req);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { locations, vehicles } = await lookupActiveOptions(client, body);
    const known = knownRideIds({
      hubs: locations.filter((row) => row.type === 'transport_hub').map((row) => ({ id: row.id, name: row.id })),
      campusPlaces: locations.filter((row) => row.type === 'campus').map((row) => ({ id: row.id, name: row.id })),
      vehicleTypes: vehicles.map((row) => ({ id: row.id, name: row.id, capacity: row.capacity })),
    });

    const validation = validateRideRequest(body, known, new Date());
    const semanticErrors = semanticLocationErrors(body, locations, vehicles);
    if (!validation.ok) {
      await client.query('ROLLBACK');
      return validationError({ ...validation.errors, ...semanticErrors });
    }
    if (Object.keys(semanticErrors).length > 0) {
      await client.query('ROLLBACK');
      return validationError(semanticErrors);
    }

    const vehicle = vehicles[0];
    if (!vehicle) {
      await client.query('ROLLBACK');
      return validationError({ vehicleTypeId: rideMessages.vehicleTypeId });
    }

    const result = await createRide(client, user.id, validation.value, vehicle.capacity);
    if (result.kind === 'unauthenticated') {
      await client.query('ROLLBACK');
      return json({ error: 'Authentication required.' }, 401);
    }
    if (result.kind === 'conflict') {
      await client.query('ROLLBACK');
      return json(
        { error: 'You already have a scheduled or active ride that overlaps this departure window.' },
        409,
      );
    }

    await client.query('COMMIT');
    const ride = result.ride;
    return json({
      ride: {
        id: ride.id,
        ownerId: ride.owner_id,
        direction: ride.direction,
        hubId: ride.hub_id,
        vehicleTypeId: ride.vehicle_type_id,
        capacity: ride.capacity_snapshot,
        departureStart: ride.departure_start,
        departureEnd: ride.departure_end,
        expectedTotalFare: ride.expected_total_fare,
        state: ride.state,
        createdAt: ride.created_at,
      },
    }, 201);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Create ride failed:', error);
    return json({ error: 'Unable to create the ride right now.' }, 500);
  } finally {
    client?.release();
  }
}
