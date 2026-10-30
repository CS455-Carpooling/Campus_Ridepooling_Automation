import { describe, expect, it } from 'vitest';
import { PATCH as handleIncident } from '@/app/api/admin/incidents/[id]/route';
import { GET as openIncidents } from '@/app/api/admin/incidents/open/route';
import { POST as raiseSos } from '@/app/api/rides/[id]/sos/route';
import { PATCH as updateSos } from '@/app/api/sos/[id]/route';
import { pool } from '@/lib/db';
import { callRoute, type Caller } from '../http';
import {
  notificationsFor,
  pooledRide,
  signedInAdmin,
  signedInStudent,
  tripStep,
} from '../fixtures';

const sos = (person: Caller, rideId: string) =>
  callRoute(raiseSos, { method: 'POST', params: { id: rideId }, as: person });

const update = (person: Caller, incidentId: string, body: Record<string, unknown>) =>
  callRoute(updateSos, { method: 'PATCH', params: { id: incidentId }, as: person, body });

const handle = (admin: Caller, incidentId: string, body: Record<string, unknown>) =>
  callRoute(handleIncident, { method: 'PATCH', params: { id: incidentId }, as: admin, body });

async function auditRows(entityId: string) {
  const { rows } = await pool.query(
    `SELECT action, outcome, error_code, reason FROM admin_audit_log
     WHERE entity_id = $1 ORDER BY created_at, id`,
    [entityId],
  );
  return rows;
}

/** A ride in pickup with two riders. */
async function rideInPickup() {
  const trip = await pooledRide({ riders: 2, startsIn: 30 });
  expect((await tripStep(trip.owner, trip.ride.id, 'pickup_in_progress')).status).toBe(200);
  return trip;
}

// Core workflow phase 11 (CS455-112): SOS (FR-RD-15, FR-RO-13.2) and its handling (CS455-65).
describe('raising an SOS', () => {
  it('creates one alert per person, however often they tap, and tells nobody in the pool', async () => {
    const { owner, ride, riders } = await rideInPickup();

    const raised = await sos(riders[0], ride.id);
    expect(raised.status).toBe(201);
    expect(raised.body.incident).toMatchObject({
      reference: expect.stringMatching(/^SOS-[0-9A-F]{8}$/i),
      status: 'open',
      locationShared: false,
      falseAlarm: false,
    });

    const tappedAgain = await sos(riders[0], ride.id);
    expect(tappedAgain.status).toBe(200);
    expect(tappedAgain.body.incident.id).toBe(raised.body.incident.id);

    // The owner may raise their own.
    expect((await sos(owner, ride.id)).status).toBe(201);
    const count = await pool.query('SELECT count(*)::int AS n FROM sos_incidents');
    expect(count.rows[0].n).toBe(2);

    // FR-RD-15.4: no trace for the others on the ride.
    for (const person of [owner, riders[1]]) {
      const titles = (await notificationsFor(person.id)).map((n) => n.title.toLowerCase());
      expect(titles.some((title) => title.includes('sos'))).toBe(false);
    }
  });

  it('keeps the mobile number and a snapshot of the trip for the admins', async () => {
    const { ride, riders } = await rideInPickup();
    await pool.query(`UPDATE user_profiles SET mobile_number = '9876500001' WHERE user_id = $1`, [
      riders[0].id,
    ]);
    const raised = await sos(riders[0], ride.id);
    const { rows } = await pool.query(
      'SELECT raised_by, raised_role, trip_state, mobile_number, context FROM sos_incidents WHERE id = $1',
      [raised.body.incident.id],
    );
    expect(rows[0]).toMatchObject({
      raised_by: riders[0].id,
      raised_role: 'rider',
      trip_state: 'pickup_in_progress',
      mobile_number: '9876500001',
    });
    expect(rows[0].context.occupants).toHaveLength(3);
  });

  it('is only for people on the ride while the trip is under way', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: 30 });
    const before = await sos(riders[0], ride.id);
    expect([before.status, before.body.code]).toEqual([409, 'not_active']);

    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const outsider = await sos(await signedInStudent(), ride.id);
    expect(outsider.status).toBe(404);
  });

  it('lets only the person who raised it add a location or call it a false alarm', async () => {
    const { owner, ride, riders } = await rideInPickup();
    const id = (await sos(riders[0], ride.id)).body.incident.id;

    expect((await update(riders[1], id, { latitude: 26.5, longitude: 80.2 })).status).toBe(404);
    expect((await update(owner, id, { falseAlarm: true })).status).toBe(404);
    const badPlace = await update(riders[0], id, { latitude: 200, longitude: 80.2 });
    expect([badPlace.status, badPlace.body.code]).toEqual([400, 'invalid']);

    const located = await update(riders[0], id, {
      latitude: 26.5123,
      longitude: 80.2329,
      accuracy: 15,
    });
    expect(located.status).toBe(200);
    expect(located.body.incident.locationShared).toBe(true);
    const falseAlarm = await update(riders[0], id, { falseAlarm: true });
    expect(falseAlarm.body.incident.falseAlarm).toBe(true);

    const { rows } = await pool.query(
      'SELECT latitude, longitude, accuracy_m, false_alarm_at FROM sos_incidents WHERE id = $1',
      [id],
    );
    expect(rows[0]).toMatchObject({ latitude: 26.5123, longitude: 80.2329, accuracy_m: 15 });
    expect(rows[0].false_alarm_at).toBeInstanceOf(Date);
  });
});

describe('admins handling an SOS (CS455-65)', () => {
  it('shows the alert until acknowledged, then closes it with a note, auditing each step', async () => {
    const { ride, riders } = await rideInPickup();
    const admin = await signedInAdmin();
    const incident = (await sos(riders[0], ride.id)).body.incident;

    const open = await callRoute(openIncidents, { as: admin });
    expect(open.body).toMatchObject({
      unacknowledged: 1,
      newest: { id: incident.id, reference: incident.reference },
    });

    const acknowledged = await handle(admin, incident.id, { action: 'acknowledge' });
    expect(acknowledged.status).toBe(200);
    expect(acknowledged.body.incident.status).toBe('acknowledged');
    expect((await callRoute(openIncidents, { as: admin })).body.unacknowledged).toBe(0);

    const twice = await handle(admin, incident.id, { action: 'acknowledge' });
    expect([twice.status, twice.body.code]).toEqual([409, 'already_acknowledged']);

    const noNote = await handle(admin, incident.id, { action: 'close' });
    expect([noNote.status, noNote.body.code]).toEqual([400, 'invalid']);

    const closed = await handle(admin, incident.id, {
      action: 'close',
      note: 'Called the rider; they were safe.',
    });
    expect(closed.status).toBe(200);
    expect(closed.body.incident.status).toBe('closed');

    expect(await auditRows(incident.id)).toEqual([
      { action: 'incident.acknowledge', outcome: 'succeeded', error_code: null, reason: null },
      {
        action: 'incident.acknowledge',
        outcome: 'refused',
        error_code: 'already_acknowledged',
        reason: null,
      },
      {
        action: 'incident.close',
        outcome: 'succeeded',
        error_code: null,
        reason: 'Called the rider; they were safe.',
      },
    ]);

    // A closed alert can no longer be changed, by the admin or the rider.
    const reopen = await handle(admin, incident.id, { action: 'acknowledge' });
    expect([reopen.status, reopen.body.code]).toEqual([409, 'closed']);
    const late = await update(riders[0], incident.id, { falseAlarm: true });
    expect([late.status, late.body.code]).toEqual([409, 'closed']);
  });

  it('keeps students out of the incident routes', async () => {
    const { ride, riders } = await rideInPickup();
    const incident = (await sos(riders[0], ride.id)).body.incident;

    expect((await callRoute(openIncidents, { as: riders[0] })).status).toBe(403);
    const refused = await handle(riders[0], incident.id, { action: 'acknowledge' });
    expect([refused.status, refused.body.code]).toEqual([403, 'not_admin']);
    expect(await auditRows(incident.id)).toEqual([]);
  });

  it('keeps the original alert unchangeable in the database', async () => {
    const { ride, riders } = await rideInPickup();
    const incident = (await sos(riders[0], ride.id)).body.incident;

    await expect(
      pool.query(`UPDATE sos_incidents SET mobile_number = '1111111111' WHERE id = $1`, [
        incident.id,
      ]),
    ).rejects.toThrow();
    await expect(
      pool.query('DELETE FROM sos_incidents WHERE id = $1', [incident.id]),
    ).rejects.toThrow();
  });
});
