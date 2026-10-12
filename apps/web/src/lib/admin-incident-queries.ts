import 'server-only';
import { pool } from './db';
import { isUuid } from './ids';
import type { SosContext } from './sos';
import type { IncidentStatus } from './sos-rules';

/**
 * What operations admins read about SOS alerts (CS455-65: FR-RD-15.2, FR-RO-13.2). Admins only:
 * every caller checks requireAdminPage() or requireAdminApi() first. The mobile number and the
 * location are personal data shown to admins alone (SYS-NFR-07).
 */

export type IncidentSummary = {
  id: string;
  reference: string;
  status: IncidentStatus;
  raisedAt: string;
  raiserName: string;
  raisedRole: 'owner' | 'rider';
  rideTitle: string;
  falseAlarm: boolean;
  locationShared: boolean;
};

export type IncidentDetail = IncidentSummary & {
  rideId: string;
  raiserId: string;
  tripState: 'pickup_in_progress' | 'in_transit';
  mobileNumber: string | null;
  location: { latitude: number; longitude: number; accuracyM: number | null; at: string } | null;
  falseAlarmAt: string | null;
  context: SosContext;
  acknowledged: { at: string; by: string } | null;
  closed: { at: string; by: string; note: string } | null;
};

type SummaryRow = {
  id: string;
  reference: string;
  status: IncidentStatus;
  raised_at: Date;
  raiser_name: string;
  raised_role: 'owner' | 'rider';
  ride_title: string;
  false_alarm_at: Date | null;
  located_at: Date | null;
};

const SUMMARY_COLUMNS = `
  s.id, s.reference, s.status, s.raised_at, s.raised_role, s.false_alarm_at, s.located_at,
  COALESCE(p.display_name, u.full_name) AS raiser_name, s.context -> 'ride' ->> 'title' AS ride_title`;

const SUMMARY_JOINS = `
  FROM sos_incidents s
  JOIN users u ON u.id = s.raised_by
  LEFT JOIN user_profiles p ON p.user_id = u.id`;

const summary = (row: SummaryRow): IncidentSummary => ({
  id: row.id,
  reference: row.reference,
  status: row.status,
  raisedAt: row.raised_at.toISOString(),
  raiserName: row.raiser_name,
  raisedRole: row.raised_role,
  rideTitle: row.ride_title,
  falseAlarm: row.false_alarm_at !== null,
  locationShared: row.located_at !== null,
});

/** The most incidents the queue lists. */
export const INCIDENT_LIST_LIMIT = 100;

/** Open ones first, then acknowledged, then closed; newest first within each. */
export async function listIncidents(): Promise<IncidentSummary[]> {
  const { rows } = await pool.query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} ${SUMMARY_JOINS}
     ORDER BY CASE s.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
              s.raised_at DESC
     LIMIT $1`,
    [INCIDENT_LIST_LIMIT],
  );
  return rows.map(summary);
}

/** The incidents on one ride, for the admin ride view. */
export async function listRideIncidents(rideId: string): Promise<IncidentSummary[]> {
  if (!isUuid(rideId)) return [];
  const { rows } = await pool.query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} ${SUMMARY_JOINS} WHERE s.ride_id = $1 ORDER BY s.raised_at DESC`,
    [rideId],
  );
  return rows.map(summary);
}

type DetailRow = SummaryRow & {
  ride_id: string;
  raised_by: string;
  trip_state: 'pickup_in_progress' | 'in_transit';
  mobile_number: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  context: SosContext;
  acknowledged_at: Date | null;
  acknowledged_by_name: string | null;
  closed_at: Date | null;
  closed_by_name: string | null;
  close_note: string | null;
};

/** One incident in full, or null when there is none. */
export async function getIncident(incidentId: string): Promise<IncidentDetail | null> {
  if (!isUuid(incidentId)) return null;
  const row = (
    await pool.query<DetailRow>(
      `SELECT ${SUMMARY_COLUMNS}, s.ride_id, s.raised_by, s.trip_state, s.mobile_number,
              s.latitude, s.longitude, s.accuracy_m, s.context, s.acknowledged_at,
              ack.full_name AS acknowledged_by_name, s.closed_at,
              closer.full_name AS closed_by_name, s.close_note
       ${SUMMARY_JOINS}
       LEFT JOIN users ack ON ack.id = s.acknowledged_by
       LEFT JOIN users closer ON closer.id = s.closed_by
       WHERE s.id = $1`,
      [incidentId],
    )
  ).rows[0];
  if (!row) return null;
  return {
    ...summary(row),
    rideId: row.ride_id,
    raiserId: row.raised_by,
    tripState: row.trip_state,
    mobileNumber: row.mobile_number,
    location:
      row.latitude !== null && row.longitude !== null && row.located_at
        ? {
            latitude: row.latitude,
            longitude: row.longitude,
            accuracyM: row.accuracy_m,
            at: row.located_at.toISOString(),
          }
        : null,
    falseAlarmAt: row.false_alarm_at ? row.false_alarm_at.toISOString() : null,
    context: row.context,
    acknowledged: row.acknowledged_at
      ? { at: row.acknowledged_at.toISOString(), by: row.acknowledged_by_name ?? 'An admin' }
      : null,
    closed:
      row.closed_at && row.close_note
        ? {
            at: row.closed_at.toISOString(),
            by: row.closed_by_name ?? 'An admin',
            note: row.close_note,
          }
        : null,
  };
}

/** What the alert bar needs: how many alerts nobody has acknowledged, and the newest of them. */
export type OpenIncidentSummary = {
  unacknowledged: number;
  newest: { id: string; reference: string; rideTitle: string } | null;
};

export async function openIncidentSummary(): Promise<OpenIncidentSummary> {
  const { rows } = await pool.query<{
    unacknowledged: number;
    id: string | null;
    reference: string | null;
    ride_title: string | null;
  }>(
    `SELECT (SELECT count(*)::int FROM sos_incidents WHERE status = 'open') AS unacknowledged,
            newest.id, newest.reference, newest.context -> 'ride' ->> 'title' AS ride_title
     FROM (SELECT 1) one
     LEFT JOIN LATERAL (
       SELECT id, reference, context FROM sos_incidents
       WHERE status = 'open' ORDER BY raised_at DESC LIMIT 1
     ) newest ON true`,
  );
  const row = rows[0];
  return {
    unacknowledged: row?.unacknowledged ?? 0,
    newest:
      row?.id && row.reference
        ? { id: row.id, reference: row.reference, rideTitle: row.ride_title ?? '' }
        : null,
  };
}
