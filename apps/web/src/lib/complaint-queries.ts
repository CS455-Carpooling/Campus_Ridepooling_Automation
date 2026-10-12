import 'server-only';
import {
  complaintFormClosesAt,
  complaintWindow,
  type ComplaintCategory,
  type ComplaintStatus,
  type ComplaintWindow,
} from './complaint-rules';
import { pool } from './db';
import { isUuid } from './ids';
import type { Direction } from './ride-rules';
import { rideTitle, type RideState } from './ride-status';

/** Someone the viewer may complain about, named by their seat, never by account (CS455-53). */
export type ComplaintPerson = {
  occupantId: string;
  name: string;
  isOwner: boolean;
  campusPlace: string;
  /** The reference of the viewer's complaint about them on this ride, if there is one. */
  filedReference: string | null;
};

/** A chat message the viewer is reporting (FR-RD-09.6), from someone else on the ride. */
export type ReportedMessage = {
  id: string;
  body: string;
  sentAt: string;
  senderOccupantId: string;
};

export type ComplaintFormPage = {
  rideId: string;
  title: string;
  direction: Direction;
  departureStart: string;
  departureEnd: string;
  state: RideState;
  window: ComplaintWindow;
  /** 7 days after completion; null while the ride is not completed. */
  closesAt: string | null;
  /** Everyone else on the ride, owner first. */
  people: ComplaintPerson[];
  message: ReportedMessage | null;
};

type RideRow = {
  id: string;
  direction: Direction;
  state: RideState;
  departure_start: Date;
  departure_end: Date;
  completed_at: Date | null;
  hub_name: string;
};

type PersonRow = {
  occupant_id: string;
  name: string;
  is_owner: boolean;
  campus_place: string;
  filed_reference: string | null;
};

type MessageRow = { id: string; body: string; created_at: Date; sender_occupant_id: string };

// The join on the viewer's seat is the access check: only the people on a ride see this page.
const RIDE_SQL = `
  SELECT r.id, r.direction, r.state, r.departure_start, r.departure_end, r.completed_at,
         hub.name AS hub_name
  FROM rides r
  JOIN riders me ON me.ride_id = r.id AND me.user_id = $2
  JOIN locations hub ON hub.id = r.hub_id
  WHERE r.id = $1`;

const PEOPLE_SQL = `
  SELECT m.id AS occupant_id, COALESCE(profile.display_name, u.full_name) AS name,
         (m.user_id = r.owner_id) AS is_owner, place.name AS campus_place,
         (SELECT c.reference FROM complaints c
          WHERE c.ride_id = m.ride_id AND c.complainant_id = $2 AND c.accused_id = m.user_id)
           AS filed_reference
  FROM riders m
  JOIN rides r ON r.id = m.ride_id
  JOIN users u ON u.id = m.user_id
  LEFT JOIN user_profiles profile ON profile.user_id = u.id
  JOIN locations place ON place.id = m.campus_location_id
  WHERE m.ride_id = $1 AND m.user_id <> $2
  ORDER BY (m.user_id = r.owner_id) DESC, m.joined_at, m.id`;

// A message in this ride's chat sent by someone else on the ride, never the viewer's own.
const MESSAGE_SQL = `
  SELECT m.id, m.body, m.created_at, sender.id AS sender_occupant_id
  FROM ride_chat_messages m
  JOIN ride_chats c ON c.id = m.chat_id
  JOIN riders sender ON sender.ride_id = c.ride_id AND sender.user_id = m.sender_id
  WHERE m.id = $1 AND c.ride_id = $2 AND m.sender_id <> $3`;

/**
 * The complaint form for `viewerId` on a ride (FR-RD-13.1, 09.6), or null when the ride does
 * not exist or they have no seat on it, so the page answers "not found" either way. A
 * `messageId` that is not a message from someone else in this ride's chat is ignored.
 */
export async function getComplaintFormPage(
  rideId: string,
  viewerId: string,
  messageId: string | null,
  now: Date = new Date(),
): Promise<ComplaintFormPage | null> {
  if (!isUuid(rideId) || !isUuid(viewerId)) return null;
  const ride = (await pool.query<RideRow>(RIDE_SQL, [rideId, viewerId])).rows[0];
  if (!ride) return null;

  const [people, message] = await Promise.all([
    pool.query<PersonRow>(PEOPLE_SQL, [rideId, viewerId]),
    isUuid(messageId)
      ? pool.query<MessageRow>(MESSAGE_SQL, [messageId, rideId, viewerId])
      : Promise.resolve({ rows: [] as MessageRow[] }),
  ]);
  const reported = message.rows[0];

  return {
    rideId: ride.id,
    title: rideTitle(ride.direction, ride.hub_name),
    direction: ride.direction,
    departureStart: ride.departure_start.toISOString(),
    departureEnd: ride.departure_end.toISOString(),
    state: ride.state,
    window: complaintWindow(ride.state, ride.completed_at, now),
    closesAt: ride.completed_at ? complaintFormClosesAt(ride.completed_at).toISOString() : null,
    people: people.rows.map((person) => ({
      occupantId: person.occupant_id,
      name: person.name,
      isOwner: person.is_owner,
      campusPlace: person.campus_place,
      filedReference: person.filed_reference,
    })),
    message: reported
      ? {
          id: reported.id,
          body: reported.body,
          sentAt: reported.created_at.toISOString(),
          senderOccupantId: reported.sender_occupant_id,
        }
      : null,
  };
}

/** One of the rider's own complaints (FR-RD-13.5): its status, never the sanction. */
export type MyComplaint = {
  reference: string;
  rideId: string;
  rideTitle: string;
  departureStart: string;
  about: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  /** Once resolved: whether any action was taken. */
  actionTaken: boolean | null;
  filedAt: string;
};

type MyComplaintRow = {
  reference: string;
  ride_id: string;
  direction: Direction;
  hub_name: string;
  departure_start: Date;
  about: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  action_taken: boolean | null;
  created_at: Date;
};

const MY_COMPLAINTS_SQL = `
  SELECT c.reference, c.ride_id, r.direction, hub.name AS hub_name, r.departure_start,
         COALESCE(profile.display_name, u.full_name) AS about,
         c.category, c.status, c.action_taken, c.created_at
  FROM complaints c
  JOIN rides r ON r.id = c.ride_id
  JOIN locations hub ON hub.id = r.hub_id
  JOIN users u ON u.id = c.accused_id
  LEFT JOIN user_profiles profile ON profile.user_id = u.id
  WHERE c.complainant_id = $1
  ORDER BY c.created_at DESC
  LIMIT 100`;

/** The complaints `userId` filed, newest first, chat reports included. */
export async function getMyComplaints(userId: string): Promise<MyComplaint[]> {
  if (!isUuid(userId)) return [];
  const { rows } = await pool.query<MyComplaintRow>(MY_COMPLAINTS_SQL, [userId]);
  return rows.map((row) => ({
    reference: row.reference,
    rideId: row.ride_id,
    rideTitle: rideTitle(row.direction, row.hub_name),
    departureStart: row.departure_start.toISOString(),
    about: row.about,
    category: row.category,
    status: row.status,
    actionTaken: row.status === 'resolved' ? row.action_taken : null,
    filedAt: row.created_at.toISOString(),
  }));
}
