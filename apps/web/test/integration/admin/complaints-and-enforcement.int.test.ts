import { describe, expect, it } from 'vitest';
import { PATCH as reviewComplaint } from '@/app/api/admin/complaints/[id]/route';
import { POST as reactivate } from '@/app/api/admin/riders/[id]/reactivation/route';
import { POST as suspend } from '@/app/api/admin/riders/[id]/suspensions/route';
import { POST as warn } from '@/app/api/admin/riders/[id]/warnings/route';
import { POST as fileComplaint } from '@/app/api/rides/[id]/complaints/route';
import { POST as rate } from '@/app/api/rides/[id]/ratings/route';
import { POST as createRide } from '@/app/api/rides/route';
import { POST as acknowledgeWarning } from '@/app/api/warnings/[id]/acknowledge/route';
import { pool } from '@/lib/db';
import { callRoute, type Caller } from '../http';
import {
  markSeat,
  notificationsFor,
  offerRide,
  pooledRide,
  requestSeat,
  rideOffer,
  seatsOf,
  signedInAdmin,
  signedInStudent,
  tripStep,
} from '../fixtures';

const DESCRIPTION = 'The driver kept stopping for personal errands and we missed the train.';

const complain = (person: Caller, rideId: string, body: Record<string, unknown>) =>
  callRoute(fileComplaint, { method: 'POST', params: { id: rideId }, as: person, body });

const rateRide = (person: Caller, rideId: string, ratings: unknown[]) =>
  callRoute(rate, { method: 'POST', params: { id: rideId }, as: person, body: { ratings } });

/** A finished ride: the owner and two riders, completed through the trip routes. */
async function completedRide() {
  const trip = await pooledRide({ riders: 2, startsIn: 30 });
  for (const step of ['pickup_in_progress', 'in_transit', 'completed']) {
    expect((await tripStep(trip.owner, trip.ride.id, step)).status).toBe(200);
  }
  const [ownerSeat, firstSeat, secondSeat] = await seatsOf(trip.ride.id);
  return { ...trip, seats: { owner: ownerSeat.id, first: firstSeat.id, second: secondSeat.id } };
}

async function auditActions(entityId: string) {
  const { rows } = await pool.query(
    `SELECT action, outcome FROM admin_audit_log WHERE entity_id = $1 ORDER BY created_at, id`,
    [entityId],
  );
  return rows.map((row) => `${row.action}:${row.outcome}`);
}

// Core workflow phases 9 and 10 (CS455-112): ratings and complaints (FR-RD-12, FR-RD-13).
describe('complaints (FR-RD-13)', () => {
  it('opens on completion, files once per person, and falls back to manual review without Gemini', async () => {
    const { owner, ride, riders, seats } = await completedRide();

    const filed = await complain(riders[0], ride.id, {
      occupantId: seats.owner,
      category: 'tardiness',
      description: DESCRIPTION,
    });
    expect(filed.status).toBe(201);
    expect(filed.body.reference).toEqual(expect.any(String));

    const { rows } = await pool.query(
      `SELECT c.id, c.complainant_id, c.accused_id, c.category, c.status, a.outcome
       FROM complaints c LEFT JOIN complaint_ai_analyses a ON a.complaint_id = c.id
       WHERE c.reference = $1`,
      [filed.body.reference],
    );
    expect(rows[0]).toMatchObject({
      complainant_id: riders[0].id,
      accused_id: owner.id,
      category: 'tardiness',
      status: 'submitted',
      // GEMINI_API_KEY is empty in the tests: the analysis records the fallback (SYS-FR-46).
      outcome: 'fallback_service_error',
    });

    const again = await complain(riders[0], ride.id, {
      occupantId: seats.owner,
      category: 'safety',
      description: DESCRIPTION,
    });
    expect([again.status, again.body.code]).toEqual([409, 'already_filed']);
  });

  it('refuses before the trip, outsiders, oneself and a too-short description', async () => {
    const before = await pooledRide({ riders: 1 });
    const [ownerSeat] = await seatsOf(before.ride.id);
    const early = await complain(before.riders[0], before.ride.id, {
      occupantId: ownerSeat.id,
      category: 'other',
      description: DESCRIPTION,
    });
    expect([early.status, early.body.code]).toEqual([409, 'window_closed']);

    const { ride, riders, seats } = await completedRide();
    const outsider = await complain(await signedInStudent(), ride.id, {
      occupantId: seats.owner,
      category: 'other',
      description: DESCRIPTION,
    });
    expect(outsider.status).toBe(404);

    const self = await complain(riders[0], ride.id, {
      occupantId: seats.first,
      category: 'other',
      description: DESCRIPTION,
    });
    expect([self.status, self.body.code]).toEqual([400, 'invalid']);

    const short = await complain(riders[0], ride.id, {
      occupantId: seats.owner,
      category: 'other',
      description: 'Too short',
    });
    expect([short.status, short.body.code]).toEqual([400, 'invalid']);
    expect(Object.keys(short.body.fields)).toEqual(['description']);
  });

  it('lets a rider marked as a no-show dispute it before the ride is completed', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: -20 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const [ownerSeat, seat] = await seatsOf(ride.id);
    expect((await markSeat(owner, ride.id, seat.id, 'no_show')).status).toBe(200);

    const disputed = await complain(riders[0], ride.id, {
      occupantId: ownerSeat.id,
      category: 'other',
      description: 'I was at the pickup point on time; the owner did not stop.',
    });
    expect(disputed.status).toBe(201);
  });

  it('is reviewed by an admin with a version check, and every step is audited', async () => {
    const { ride, riders, seats } = await completedRide();
    const admin = await signedInAdmin();
    const reference = (
      await complain(riders[0], ride.id, {
        occupantId: seats.owner,
        category: 'tardiness',
        description: DESCRIPTION,
      })
    ).body.reference;
    const { rows } = await pool.query('SELECT id FROM complaints WHERE reference = $1', [
      reference,
    ]);
    const id = rows[0].id;
    const review = (body: Record<string, unknown>) =>
      callRoute(reviewComplaint, { method: 'PATCH', params: { id }, as: admin, body });

    expect((await review({ status: 'under_review', version: 1 })).status).toBe(200);
    const stale = await review({ status: 'resolved', actionTaken: false, version: 1 });
    expect([stale.status, stale.body.code]).toEqual([409, 'version_conflict']);
    const resolved = await review({
      status: 'resolved',
      actionTaken: true,
      note: 'Warned the owner about detours.',
      version: 2,
    });
    expect(resolved.status).toBe(200);

    const complaint = await pool.query(
      'SELECT status, action_taken, resolution_note FROM complaints WHERE id = $1',
      [id],
    );
    expect(complaint.rows[0]).toEqual({
      status: 'resolved',
      action_taken: true,
      resolution_note: 'Warned the owner about detours.',
    });
    expect(await auditActions(id)).toEqual([
      'complaint.status:succeeded',
      'complaint.status:refused',
      'complaint.status:succeeded',
    ]);

    const student = await callRoute(reviewComplaint, {
      method: 'PATCH',
      params: { id },
      as: riders[1],
      body: { status: 'under_review', version: 3 },
    });
    expect(student.status).toBe(403);
  });
});

describe('ratings (FR-RD-12, FR-RO-12)', () => {
  it('opens on completion, once per rater, never for oneself', async () => {
    const { owner, ride, riders, seats } = await completedRide();

    const rated = await rateRide(riders[0], ride.id, [
      { occupantId: seats.owner, score: 5, comment: 'On time.' },
      { occupantId: seats.second, score: 4 },
    ]);
    expect([rated.status, rated.body]).toEqual([201, { rated: 2 }]);
    const stored = await pool.query('SELECT count(*)::int AS n FROM ride_ratings');
    expect(stored.rows[0].n).toBe(2);

    const again = await rateRide(riders[0], ride.id, [{ occupantId: seats.owner, score: 1 }]);
    expect([again.status, again.body.code]).toEqual([409, 'already_rated']);

    const self = await rateRide(owner, ride.id, [{ occupantId: seats.owner, score: 5 }]);
    expect([self.status, self.body.code]).toEqual([400, 'self_rating']);

    const outOfRange = await rateRide(riders[1], ride.id, [{ occupantId: seats.owner, score: 6 }]);
    expect([outOfRange.status, outOfRange.body.code]).toEqual([400, 'invalid_ratings']);
  });

  it('is closed before completion and never covers a no-show', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 2, startsIn: -20 });
    const [ownerSeat, missing] = await seatsOf(ride.id);
    const early = await rateRide(riders[1], ride.id, [{ occupantId: ownerSeat.id, score: 5 }]);
    expect(early.status).toBe(409);

    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    expect((await markSeat(owner, ride.id, missing.id, 'no_show')).status).toBe(200);
    expect((await tripStep(owner, ride.id, 'completed')).status).toBe(200);

    const aboutNoShow = await rateRide(owner, ride.id, [{ occupantId: missing.id, score: 1 }]);
    expect([aboutNoShow.status, aboutNoShow.body.code]).toEqual([400, 'not_on_ride']);
    const byNoShow = await rateRide(riders[0], ride.id, [{ occupantId: ownerSeat.id, score: 1 }]);
    // A no-show is no longer on the ride, so for them it does not exist.
    expect([byNoShow.status, byNoShow.body.code]).toEqual([404, 'not_found']);
  });
});

describe('warnings and suspensions (OA-FR-21 to OA-FR-28)', () => {
  it('blocks a warned rider until they acknowledge the warning', async () => {
    const admin = await signedInAdmin();
    const rider = await signedInStudent();

    const warned = await callRoute(warn, {
      method: 'POST',
      params: { id: rider.id },
      as: admin,
      body: { reason: 'Repeated late arrivals reported by other riders.' },
    });
    expect(warned.status).toBe(201);
    const warningId = warned.body.warning.id;
    expect(await auditActions(rider.id)).toEqual(['rider.warn:succeeded']);

    const blocked = await callRoute(createRide, { method: 'POST', as: rider, body: rideOffer() });
    expect(blocked.status).toBe(401);

    const acknowledged = await callRoute(acknowledgeWarning, {
      method: 'POST',
      params: { id: warningId },
      as: rider,
    });
    expect([acknowledged.status, acknowledged.body]).toEqual([200, { acknowledged: true }]);
    expect(
      (await callRoute(createRide, { method: 'POST', as: rider, body: rideOffer() })).status,
    ).toBe(201);

    // Nobody else can acknowledge it.
    const other = await callRoute(acknowledgeWarning, {
      method: 'POST',
      params: { id: warningId },
      as: await signedInStudent(),
    });
    expect(other.status).toBe(404);
  });

  it('stops a suspended rider offering or joining rides until an admin lifts it', async () => {
    const admin = await signedInAdmin();
    const rider = await signedInStudent();
    const otherOwner = await signedInStudent();
    const openRide = await offerRide(otherOwner);
    const suspendBody = {
      reasonCategory: 'safety',
      reason: 'Unsafe behaviour on a ride.',
      days: 3,
    };

    const suspended = await callRoute(suspend, {
      method: 'POST',
      params: { id: rider.id },
      as: admin,
      body: suspendBody,
    });
    expect(suspended.status).toBe(201);
    const twice = await callRoute(suspend, {
      method: 'POST',
      params: { id: rider.id },
      as: admin,
      body: suspendBody,
    });
    expect([twice.status, twice.body.code]).toEqual([409, 'already_suspended']);

    const offer = await callRoute(createRide, { method: 'POST', as: rider, body: rideOffer() });
    expect([offer.status, offer.body.code]).toEqual([403, 'suspended']);
    expect(offer.body.error).toContain('(reason: Safety)');
    const join = await requestSeat(rider, openRide.id);
    expect([join.status, join.body.code]).toEqual([403, 'suspended']);
    expect((await notificationsFor(rider.id)).length).toBeGreaterThanOrEqual(1);

    const lifted = await callRoute(reactivate, {
      method: 'POST',
      params: { id: rider.id },
      as: admin,
      body: { reason: 'Reviewed with the rider; cleared.' },
    });
    expect(lifted.status).toBe(200);
    expect((await requestSeat(rider, openRide.id)).status).toBe(201);
    expect(await auditActions(rider.id)).toEqual([
      'rider.suspend:succeeded',
      'rider.suspend:refused',
      'rider.reactivate:succeeded',
    ]);
  });

  it('allows enforcement by admins only, in the API and in the database', async () => {
    const student = await signedInStudent();
    const rider = await signedInStudent();

    const refused = await callRoute(suspend, {
      method: 'POST',
      params: { id: rider.id },
      as: student,
      body: { reasonCategory: 'other', reason: 'Not allowed.', indefinite: true },
    });
    expect([refused.status, refused.body.code]).toEqual([403, 'not_admin']);

    // The trigger behind the API: a warning issued by a student is rejected outright.
    await expect(
      pool.query(`INSERT INTO rider_warnings (user_id, reason, issued_by) VALUES ($1, 'x', $2)`, [
        rider.id,
        student.id,
      ]),
    ).rejects.toThrow();
  });
});
