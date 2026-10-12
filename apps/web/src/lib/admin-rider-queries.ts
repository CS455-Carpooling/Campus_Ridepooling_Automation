import 'server-only';
import type { EarlierComplaint } from './admin-complaint-queries';
import type { ComplaintCategory, ComplaintStatus } from './complaint-rules';
import { pool } from './db';
import { isUuid } from './ids';
import type { Direction } from './ride-rules';
import { rideTitle, type RideState } from './ride-status';
import { getActiveSuspension, type ActiveSuspension } from './suspensions';
import { seatStatus, type SeatStatus } from './trip-rules';

/**
 * The admin's view of riders (OA-FR-42, SYS-NFR-07, CS455-53): finding one, their record, and
 * a ride as it stands. Identity details (email, roll number, mobile) are read only here, for
 * admins. Nothing here changes a rider or a ride (SYS-FR-17, 44).
 */

export type RiderSearchResult = {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  isAdmin: boolean;
  suspended: boolean;
};

const MIN_QUERY = 2;

/** Riders whose name, email or roll number contains `query` (at least 2 characters). */
export async function searchRiders(query: string): Promise<RiderSearchResult[]> {
  const text = query.trim();
  if (text.length < MIN_QUERY) return [];
  const pattern = `%${text.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
  const { rows } = await pool.query<{
    id: string;
    name: string;
    email: string;
    roll_number: string;
    role: string;
    suspended: boolean;
  }>(
    `SELECT u.id, COALESCE(p.display_name, u.full_name) AS name, u.email, u.roll_number, u.role,
            EXISTS (SELECT 1 FROM active_rider_suspensions s WHERE s.user_id = u.id) AS suspended
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.full_name ILIKE $1 OR p.display_name ILIKE $1 OR u.email ILIKE $1
        OR u.roll_number ILIKE $1
     ORDER BY lower(COALESCE(p.display_name, u.full_name)), u.email
     LIMIT 50`,
    [pattern],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    rollNumber: row.roll_number,
    isAdmin: row.role === 'admin',
    suspended: row.suspended,
  }));
}

export type RiderRide = {
  id: string;
  title: string;
  departureStart: string;
  state: RideState;
  asOwner: boolean;
  /** The owner marked them a no-show on this ride (FR-RO-10.3), for review. */
  noShow: boolean;
};

export type RiderWarning = {
  id: string;
  reason: string;
  issuedAt: string;
  issuedBy: string;
  complaintReference: string | null;
};

export type RiderSuspension = {
  id: string;
  reasonCategory: ComplaintCategory;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  isIndefinite: boolean;
  issuedBy: string;
  liftedAt: string | null;
  liftedBy: string | null;
  liftReason: string | null;
};

/** A rider's record for an admin (OA-FR-42): who they are, and everything on their account. */
export type RiderRecord = {
  id: string;
  fullName: string;
  displayName: string | null;
  email: string;
  rollNumber: string;
  mobile: string | null;
  isAdmin: boolean;
  verified: boolean;
  joinedAt: string;
  suspension: ActiveSuspension | null;
  rides: RiderRide[];
  complaintsFiled: EarlierComplaint[];
  complaintsReceived: EarlierComplaint[];
  warnings: RiderWarning[];
  suspensions: RiderSuspension[];
};

type IdentityRow = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  roll_number: string;
  mobile_number: string | null;
  role: string;
  email_verified_at: Date | null;
  created_at: Date;
};

type ComplaintRow = {
  id: string;
  reference: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  created_at: Date;
};

const complaintsBy = (column: 'complainant_id' | 'accused_id') => `
  SELECT id, reference, category, status, created_at FROM complaints
  WHERE ${column} = $1 ORDER BY created_at DESC LIMIT 50`;

const toComplaint = (row: ComplaintRow): EarlierComplaint => ({
  id: row.id,
  reference: row.reference,
  category: row.category,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

/** The record of `userId`, or null when there is no such account. */
export async function getRiderRecord(
  userId: string,
  now: Date = new Date(),
): Promise<RiderRecord | null> {
  if (!isUuid(userId)) return null;
  const identity = (
    await pool.query<IdentityRow>(
      `SELECT u.id, u.full_name, p.display_name, u.email, u.roll_number, p.mobile_number, u.role,
              u.email_verified_at, u.created_at
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    )
  ).rows[0];
  if (!identity) return null;

  const [suspension, rides, filed, received, warnings, suspensions] = await Promise.all([
    getActiveSuspension(userId, now),
    pool.query<{
      id: string;
      direction: Direction;
      hub_name: string;
      departure_start: Date;
      state: RideState;
      as_owner: boolean;
      no_show: boolean;
    }>(
      `SELECT r.id, r.direction, hub.name AS hub_name, r.departure_start, r.state,
              (r.owner_id = $1) AS as_owner, (m.no_show_at IS NOT NULL) AS no_show
       FROM riders m
       JOIN rides r ON r.id = m.ride_id
       JOIN locations hub ON hub.id = r.hub_id
       WHERE m.user_id = $1
       ORDER BY r.departure_start DESC
       LIMIT 30`,
      [userId],
    ),
    pool.query<ComplaintRow>(complaintsBy('complainant_id'), [userId]),
    pool.query<ComplaintRow>(complaintsBy('accused_id'), [userId]),
    pool.query<{
      id: string;
      reason: string;
      issued_at: Date;
      issued_by: string;
      complaint_reference: string | null;
    }>(
      `SELECT w.id, w.reason, w.issued_at, admin.full_name AS issued_by,
              c.reference AS complaint_reference
       FROM rider_warnings w
       JOIN users admin ON admin.id = w.issued_by
       LEFT JOIN complaints c ON c.id = w.complaint_id
       WHERE w.user_id = $1
       ORDER BY w.issued_at DESC`,
      [userId],
    ),
    pool.query<{
      id: string;
      reason_category: ComplaintCategory;
      reason: string;
      starts_at: Date;
      ends_at: Date | null;
      is_indefinite: boolean;
      issued_by: string;
      lifted_at: Date | null;
      lifted_by: string | null;
      lift_reason: string | null;
    }>(
      `SELECT s.id, s.reason_category, s.reason, s.starts_at, s.ends_at, s.is_indefinite,
              issuer.full_name AS issued_by, s.lifted_at, lifter.full_name AS lifted_by,
              s.lift_reason
       FROM rider_suspensions s
       JOIN users issuer ON issuer.id = s.issued_by
       LEFT JOIN users lifter ON lifter.id = s.lifted_by
       WHERE s.user_id = $1
       ORDER BY s.starts_at DESC`,
      [userId],
    ),
  ]);

  return {
    id: identity.id,
    fullName: identity.full_name,
    displayName: identity.display_name,
    email: identity.email,
    rollNumber: identity.roll_number,
    mobile: identity.mobile_number,
    isAdmin: identity.role === 'admin',
    verified: identity.email_verified_at !== null,
    joinedAt: identity.created_at.toISOString(),
    suspension,
    rides: rides.rows.map((ride) => ({
      id: ride.id,
      title: rideTitle(ride.direction, ride.hub_name),
      departureStart: ride.departure_start.toISOString(),
      state: ride.state,
      asOwner: ride.as_owner,
      noShow: ride.no_show,
    })),
    complaintsFiled: filed.rows.map(toComplaint),
    complaintsReceived: received.rows.map(toComplaint),
    warnings: warnings.rows.map((warning) => ({
      id: warning.id,
      reason: warning.reason,
      issuedAt: warning.issued_at.toISOString(),
      issuedBy: warning.issued_by,
      complaintReference: warning.complaint_reference,
    })),
    suspensions: suspensions.rows.map((row) => ({
      id: row.id,
      reasonCategory: row.reason_category,
      reason: row.reason,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at ? row.ends_at.toISOString() : null,
      isIndefinite: row.is_indefinite,
      issuedBy: row.issued_by,
      liftedAt: row.lifted_at ? row.lifted_at.toISOString() : null,
      liftedBy: row.lifted_by,
      liftReason: row.lift_reason,
    })),
  };
}

/** A ride as an admin sees it: read only, with everyone on it and its complaints. */
export type AdminRideView = {
  id: string;
  title: string;
  state: RideState;
  departureStart: string;
  departureEnd: string;
  vehicleName: string;
  capacity: number;
  totalFare: number;
  createdAt: string;
  completedAt: string | null;
  /** When the owner started pickup and the trip (CS455-63), or null. */
  pickupStartedAt: string | null;
  tripStartedAt: string | null;
  occupants: Array<{
    userId: string;
    name: string;
    isOwner: boolean;
    campusPlace: string;
    joinedAt: string;
    /** Where they stood at pickup (FR-RO-09.3, FR-RO-10.3). */
    status: SeatStatus;
    /** What they owed when the ride was completed (FR-RO-09.4), or null before then. */
    finalShare: number | null;
  }>;
  complaints: Array<{
    id: string;
    reference: string;
    category: ComplaintCategory;
    status: ComplaintStatus;
  }>;
};

/** One ride for an admin (OA-FR-16, SYS-FR-17), or null when there is none. */
export async function getAdminRide(rideId: string): Promise<AdminRideView | null> {
  if (!isUuid(rideId)) return null;
  const ride = (
    await pool.query<{
      id: string;
      direction: Direction;
      hub_name: string;
      state: RideState;
      departure_start: Date;
      departure_end: Date;
      vehicle_name: string;
      capacity_snapshot: number;
      expected_total_fare: number;
      created_at: Date;
      completed_at: Date | null;
      pickup_started_at: Date | null;
      trip_started_at: Date | null;
    }>(
      `SELECT r.id, r.direction, hub.name AS hub_name, r.state, r.departure_start, r.departure_end,
              vt.name AS vehicle_name, r.capacity_snapshot, r.expected_total_fare, r.created_at,
              r.completed_at, r.pickup_started_at, r.trip_started_at
       FROM rides r
       JOIN locations hub ON hub.id = r.hub_id
       JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
       WHERE r.id = $1`,
      [rideId],
    )
  ).rows[0];
  if (!ride) return null;

  const [occupants, complaints] = await Promise.all([
    pool.query<{
      user_id: string;
      name: string;
      is_owner: boolean;
      campus_place: string;
      joined_at: Date;
      left_at: Date | null;
      checked_in_at: Date | null;
      arrived_at: Date | null;
      no_show_at: Date | null;
      final_share: number | null;
    }>(
      `SELECT m.user_id, COALESCE(p.display_name, u.full_name) AS name,
              (m.user_id = r.owner_id) AS is_owner, place.name AS campus_place, m.joined_at,
              m.left_at, m.checked_in_at, m.arrived_at, m.no_show_at, final.share AS final_share
       FROM riders m
       JOIN rides r ON r.id = m.ride_id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN ride_final_shares final ON final.ride_id = m.ride_id AND final.user_id = m.user_id
       JOIN locations place ON place.id = m.campus_location_id
       WHERE m.ride_id = $1
       ORDER BY (m.user_id = r.owner_id) DESC, m.joined_at, m.id`,
      [rideId],
    ),
    pool.query<{
      id: string;
      reference: string;
      category: ComplaintCategory;
      status: ComplaintStatus;
    }>(
      `SELECT id, reference, category, status FROM complaints WHERE ride_id = $1
       ORDER BY created_at DESC`,
      [rideId],
    ),
  ]);

  return {
    id: ride.id,
    title: rideTitle(ride.direction, ride.hub_name),
    state: ride.state,
    departureStart: ride.departure_start.toISOString(),
    departureEnd: ride.departure_end.toISOString(),
    vehicleName: ride.vehicle_name,
    capacity: ride.capacity_snapshot,
    totalFare: ride.expected_total_fare,
    createdAt: ride.created_at.toISOString(),
    completedAt: ride.completed_at ? ride.completed_at.toISOString() : null,
    pickupStartedAt: ride.pickup_started_at ? ride.pickup_started_at.toISOString() : null,
    tripStartedAt: ride.trip_started_at ? ride.trip_started_at.toISOString() : null,
    occupants: occupants.rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      isOwner: row.is_owner,
      campusPlace: row.campus_place,
      joinedAt: row.joined_at.toISOString(),
      status: seatStatus({
        leftAt: row.left_at,
        checkedInAt: row.checked_in_at,
        arrivedAt: row.arrived_at,
        noShowAt: row.no_show_at,
      }),
      finalShare: row.final_share,
    })),
    complaints: complaints.rows,
  };
}
