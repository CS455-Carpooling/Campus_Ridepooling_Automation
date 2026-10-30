import { describe, expect, it } from 'vitest';
import { GET as openIncidents } from '@/app/api/admin/incidents/open/route';
import { GET as rideRequests } from '@/app/api/rides/[id]/requests/route';
import { POST as createRide } from '@/app/api/rides/route';
import { pool } from '@/lib/db';
import { moveDeparture, offerRide, rideOffer, signedInAdmin, signedInStudent } from './fixtures';
import { callRoute } from './http';

// The harness itself (CS455-110): real routes, a real database, a clean start for every test.
describe('integration harness', () => {
  it('offers a ride through the real API and reads it back from the database', async () => {
    const owner = await signedInStudent({ campusPlace: 'hall-3' });

    const created = await callRoute(createRide, {
      method: 'POST',
      path: '/api/rides',
      as: owner,
      body: rideOffer({ campusLocationId: 'hall-3' }),
    });
    expect(created.status).toBe(201);
    expect(created.body.ride).toMatchObject({ ownerId: owner.id, state: 'scheduled', capacity: 4 });

    const { rows } = await pool.query(
      `SELECT r.state, p.user_id, p.campus_location_id
       FROM rides r JOIN riders p ON p.ride_id = r.id WHERE r.id = $1`,
      [created.body.ride.id],
    );
    expect(rows).toEqual([{ state: 'scheduled', user_id: owner.id, campus_location_id: 'hall-3' }]);

    const requests = await callRoute(rideRequests, {
      path: `/api/rides/${created.body.ride.id}/requests`,
      params: { id: created.body.ride.id },
      as: owner,
    });
    expect(requests.status).toBe(200);
    expect(requests.body).toMatchObject({ role: 'owner', requests: [] });
  });

  it('runs the real sign-in and origin checks', async () => {
    const owner = await signedInStudent();

    const signedOut = await callRoute(createRide, { method: 'POST', body: rideOffer() });
    expect(signedOut.status).toBe(401);

    const crossSite = await callRoute(createRide, {
      method: 'POST',
      as: owner,
      origin: 'cross',
      body: rideOffer(),
    });
    expect(crossSite.status).toBe(403);
    expect(crossSite.body).toEqual({ error: 'Invalid request origin.' });

    const expired = await pool.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1`,
      [owner.id],
    );
    expect(expired.rowCount).toBe(1);
    expect(
      (await callRoute(createRide, { method: 'POST', as: owner, body: rideOffer() })).status,
    ).toBe(401);
  });

  it('reads the role from the database for admin routes', async () => {
    const student = await signedInStudent();
    const admin = await signedInAdmin();

    const refused = await callRoute(openIncidents, { as: student });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('not_admin');

    const allowed = await callRoute(openIncidents, { as: admin });
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ unacknowledged: 0, newest: null });
  });

  it('moves a ride into its lock window for trip tests', async () => {
    const owner = await signedInStudent();
    const ride = await offerRide(owner);

    await moveDeparture(ride.id, 30);
    const { rows } = await pool.query(
      `SELECT round(extract(epoch FROM departure_start - now()) / 60) AS starts_in,
              round(extract(epoch FROM departure_end - departure_start) / 60) AS window
       FROM rides WHERE id = $1`,
      [ride.id],
    );
    expect(rows[0]).toEqual({ starts_in: '30', window: '60' });
  });

  describe('a clean database for every test', () => {
    it('writes a ride', async () => {
      await offerRide(await signedInStudent());
      const { rows } = await pool.query('SELECT count(*)::int AS rides FROM rides');
      expect(rows[0].rides).toBe(1);
    });

    it('no longer sees it, and still has the schema reference data', async () => {
      const { rows } = await pool.query(
        `SELECT (SELECT count(*)::int FROM rides) AS rides,
                (SELECT count(*)::int FROM users) AS users,
                (SELECT count(*)::int FROM locations) AS places,
                (SELECT count(*)::int FROM vehicle_types) AS vehicles`,
      );
      expect(rows[0]).toEqual({ rides: 0, users: 0, places: 21, vehicles: 3 });
    });
  });
});
