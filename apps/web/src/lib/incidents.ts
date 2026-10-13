import 'server-only';
import type { PoolClient } from 'pg';
import { incidentActionRefusal, type IncidentAction, type IncidentStatus } from './sos-rules';

/**
 * An operations admin acknowledges an SOS alert, or closes it with a note on how it was handled
 * (CS455-65). Each runs inside withAdminAction()'s transaction, which audits it. An incident only
 * moves forward and is never deleted; the database refuses anything else (schema.sql).
 */

export type IncidentState = {
  id: string;
  reference: string;
  status: IncidentStatus;
  acknowledgedAt: string | null;
  closedAt: string | null;
};

export type IncidentChange =
  | { kind: 'changed'; before: IncidentState; after: IncidentState }
  | { kind: 'not_found' }
  | { kind: 'refused'; code: 'closed' | 'already_acknowledged'; current: IncidentState };

type Row = {
  id: string;
  reference: string;
  status: IncidentStatus;
  acknowledged_at: Date | null;
  closed_at: Date | null;
};

const COLUMNS = 'id, reference, status, acknowledged_at, closed_at';

const state = (row: Row): IncidentState => ({
  id: row.id,
  reference: row.reference,
  status: row.status,
  acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.toISOString() : null,
  closedAt: row.closed_at ? row.closed_at.toISOString() : null,
});

export async function changeIncident(
  client: PoolClient,
  incidentId: string,
  action: IncidentAction,
  adminId: string,
  now: Date,
): Promise<IncidentChange> {
  const row = (
    await client.query<Row>(`SELECT ${COLUMNS} FROM sos_incidents WHERE id = $1 FOR UPDATE`, [
      incidentId,
    ])
  ).rows[0];
  if (!row) return { kind: 'not_found' };
  const before = state(row);
  const refusal = incidentActionRefusal(row.status, action.action);
  if (refusal) return { kind: 'refused', code: refusal, current: before };

  const updated = (
    action.action === 'acknowledge'
      ? await client.query<Row>(
          `UPDATE sos_incidents
           SET status = 'acknowledged', acknowledged_at = $2, acknowledged_by = $3
           WHERE id = $1 RETURNING ${COLUMNS}`,
          [row.id, now, adminId],
        )
      : await client.query<Row>(
          `UPDATE sos_incidents
           SET status = 'closed', closed_at = $2, closed_by = $3, close_note = $4
           WHERE id = $1 RETURNING ${COLUMNS}`,
          [row.id, now, adminId, action.note],
        )
  ).rows[0];
  return { kind: 'changed', before, after: state(updated) };
}
