import 'server-only';
import type { PoolClient } from 'pg';
import type { Direction } from './ride-rules';
import { rideTitle, type RideState } from './ride-status';
import { canRaiseSos, type IncidentStatus, type SosUpdate } from './sos-rules';
import type { TripResult } from './trip';
import { isActiveSeat, seatStatus, type SeatStatus } from './trip-rules';

/**
 * SOS alerts (CS455-64: FR-RD-15, FR-RO-13.2). An active occupant raises one while the trip is
 * under way, suspended or not (FR-RD-01.5). It is stored with a snapshot of the trip for the
 * operations admins and is never shown or sent to the rest of the pool (FR-RD-15.4): no
 * notification, nothing in the ride view but the raiser's own alert. Pressing SOS again returns
 * the alert already raised. Each function runs inside the caller's transaction on `client`.
 */

/** The raiser's own view of their alert. */
export type SosIncident = {
  id: string;
  reference: string;
  raisedAt: string;
  status: IncidentStatus;
  locationShared: boolean;
  falseAlarm: boolean;
};

/** What the admins read: the trip as it was when the alert was raised. */
export type SosContext = {
  ride: {
    title: string;
    direction: Direction;
    hub: string;
    departureStart: string;
    departureEnd: string;
    vehicle: string;
    state: RideState;
  };
  occupants: Array<{
    userId: string;
    name: string;
    role: 'owner' | 'rider';
    place: string;
    status: SeatStatus;
    raisedTheAlert: boolean;
  }>;
};

type IncidentRow = {
  id: string;
  reference: string;
  raised_at: Date;
  status: IncidentStatus;
  located_at: Date | null;
  false_alarm_at: Date | null;
};

const INCIDENT_COLUMNS = 'id, reference, raised_at, status, located_at, false_alarm_at';

const incident = (row: IncidentRow): SosIncident => ({
  id: row.id,
  reference: row.reference,
  raisedAt: row.raised_at.toISOString(),
  status: row.status,
  locationShared: row.located_at !== null,
  falseAlarm: row.false_alarm_at !== null,
});

type RideRow = {
  id: string;
  owner_id: string;
  state: RideState;
  direction: Direction;
  departure_start: Date;
  departure_end: Date;
  hub_name: string;
  vehicle_name: string;
};

type SeatRow = {
  user_id: string;
  name: string;
  is_owner: boolean;
  place: string;
  left_at: Date | null;
  checked_in_at: Date | null;
  arrived_at: Date | null;
  no_show_at: Date | null;
};

// The ride row is only read: an SOS must never wait behind a trip change.
const RIDE_SQL = `
  SELECT r.id, r.owner_id, r.state, r.direction, r.departure_start, r.departure_end,
         hub.name AS hub_name, vt.name AS vehicle_name
  FROM rides r
  JOIN locations hub ON hub.id = r.hub_id
  JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
  WHERE r.id = $1`;

const SEATS_SQL = `
  SELECT m.user_id, COALESCE(p.display_name, u.full_name) AS name,
         (m.user_id = r.owner_id) AS is_owner, place.name AS place,
         m.left_at, m.checked_in_at, m.arrived_at, m.no_show_at
  FROM riders m
  JOIN rides r ON r.id = m.ride_id
  JOIN users u ON u.id = m.user_id
  LEFT JOIN user_profiles p ON p.user_id = u.id
  JOIN locations place ON place.id = m.campus_location_id
  WHERE m.ride_id = $1
  ORDER BY (m.user_id = r.owner_id) DESC, m.joined_at, m.id`;

const isActiveOccupant = (seat: Pick<SeatRow, 'left_at' | 'no_show_at'>) =>
  isActiveSeat({ leftAt: seat.left_at, noShowAt: seat.no_show_at });

// One active alert per person per ride (sos_incidents_one_active): pressing SOS again adds nothing.
const INSERT_SQL = `
  INSERT INTO sos_incidents
    (ride_id, raised_by, raised_role, trip_state, raised_at, mobile_number, context)
  VALUES ($1, $2, $3, $4, $5, (SELECT mobile_number FROM user_profiles WHERE user_id = $2), $6)
  ON CONFLICT (ride_id, raised_by) WHERE status <> 'closed' AND false_alarm_at IS NULL
  DO NOTHING
  RETURNING ${INCIDENT_COLUMNS}`;

const ACTIVE_SQL = `
  SELECT ${INCIDENT_COLUMNS} FROM sos_incidents
  WHERE ride_id = $1 AND raised_by = $2 AND status <> 'closed' AND false_alarm_at IS NULL`;

/**
 * Raises an SOS for `userId` on this ride (FR-RD-15.1, 15.2), or returns the one already active.
 * Someone without a seat gets not found, as for a ride that does not exist.
 */
export async function raiseSos(
  client: PoolClient,
  rideId: string,
  userId: string,
  now: Date,
): Promise<TripResult<{ incident: SosIncident; created: boolean }>> {
  const ride = (await client.query<RideRow>(RIDE_SQL, [rideId])).rows[0];
  if (!ride) return { kind: 'not_found' };
  const seats = (await client.query<SeatRow>(SEATS_SQL, [rideId])).rows;
  const mine = seats.find((seat) => seat.user_id === userId && isActiveOccupant(seat));
  if (!mine) return { kind: 'not_found' };
  if (!canRaiseSos(ride.state, true)) return { kind: 'refused', code: 'not_active' };

  const context: SosContext = {
    ride: {
      title: rideTitle(ride.direction, ride.hub_name),
      direction: ride.direction,
      hub: ride.hub_name,
      departureStart: ride.departure_start.toISOString(),
      departureEnd: ride.departure_end.toISOString(),
      vehicle: ride.vehicle_name,
      state: ride.state,
    },
    occupants: seats
      .filter(isActiveOccupant)
      .map((seat) => ({
        userId: seat.user_id,
        name: seat.name,
        role: seat.is_owner ? 'owner' : 'rider',
        place: seat.place,
        status: seatStatus({
          leftAt: seat.left_at,
          checkedInAt: seat.checked_in_at,
          arrivedAt: seat.arrived_at,
          noShowAt: seat.no_show_at,
        }),
        raisedTheAlert: seat.user_id === userId,
      })),
  };

  const inserted = (
    await client.query<IncidentRow>(INSERT_SQL, [
      rideId,
      userId,
      mine.is_owner ? 'owner' : 'rider',
      ride.state,
      now,
      JSON.stringify(context),
    ])
  ).rows[0];
  if (inserted) return { kind: 'done', value: { incident: incident(inserted), created: true } };

  const existing = (await client.query<IncidentRow>(ACTIVE_SQL, [rideId, userId])).rows[0];
  return { kind: 'done', value: { incident: incident(existing), created: false } };
}

/**
 * The raiser adds where they are, or says it was a false alarm (FR-RD-15.5); each only once, and
 * not after an admin closed the alert. Anyone else gets not found.
 */
export async function updateSos(
  client: PoolClient,
  incidentId: string,
  userId: string,
  update: SosUpdate,
  now: Date,
): Promise<TripResult<SosIncident>> {
  const row = (
    await client.query<IncidentRow>(
      `SELECT ${INCIDENT_COLUMNS} FROM sos_incidents WHERE id = $1 AND raised_by = $2 FOR UPDATE`,
      [incidentId, userId],
    )
  ).rows[0];
  if (!row) return { kind: 'not_found' };
  if (row.status === 'closed') return { kind: 'refused', code: 'closed' };

  if (update.kind === 'location') {
    if (row.located_at) return { kind: 'done', value: incident(row) };
    const updated = (
      await client.query<IncidentRow>(
        `UPDATE sos_incidents
         SET latitude = $2, longitude = $3, accuracy_m = $4, located_at = $5
         WHERE id = $1 RETURNING ${INCIDENT_COLUMNS}`,
        [row.id, update.latitude, update.longitude, update.accuracy, now],
      )
    ).rows[0];
    return { kind: 'done', value: incident(updated) };
  }

  if (row.false_alarm_at) return { kind: 'done', value: incident(row) };
  const updated = (
    await client.query<IncidentRow>(
      `UPDATE sos_incidents SET false_alarm_at = $2 WHERE id = $1 RETURNING ${INCIDENT_COLUMNS}`,
      [row.id, now],
    )
  ).rows[0];
  return { kind: 'done', value: incident(updated) };
}
