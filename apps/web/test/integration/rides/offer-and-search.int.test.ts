import { describe, expect, it } from 'vitest';
import { POST as createRide } from '@/app/api/rides/route';
import { pool } from '@/lib/db';
import { searchRides } from '@/lib/ride-search';
import { callRoute } from '../http';
import {
  joinRide,
  moveDeparture,
  offerRide,
  requestSeat,
  rideOffer,
  signedInStudent,
} from '../fixtures';

const MINUTE = 60_000;
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * MINUTE).toISOString();

/** The search a rider makes for the default offer: Kanpur Central, three to five hours away. */
const searchFor = (viewerId: string, extra: Record<string, unknown> = {}) =>
  searchRides(viewerId, {
    direction: 'to_hub',
    hubId: 'kanpur-central',
    campusLocationId: 'hall-2',
    departureStart: inMinutes(120),
    departureEnd: inMinutes(300),
    ...extra,
  });

// Core workflow phase 2 (CS455-111): an owner offers a ride and riders find it.
describe('offering a ride (FR-RO-01 to FR-RO-03)', () => {
  it('stores the ride with the vehicle capacity and gives the owner the first seat', async () => {
    const owner = await signedInStudent();
    const created = await callRoute(createRide, {
      method: 'POST',
      as: owner,
      body: rideOffer({ vehicleTypeId: 'auto', expectedTotalFare: 450 }),
    });

    expect(created.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT owner_id, vehicle_type_id, capacity_snapshot, expected_total_fare, state, locked_at
       FROM rides WHERE id = $1`,
      [created.body.ride.id],
    );
    expect(rows[0]).toEqual({
      owner_id: owner.id,
      vehicle_type_id: 'auto',
      capacity_snapshot: 3,
      expected_total_fare: 450,
      state: 'scheduled',
      locked_at: null,
    });
    const seats = await pool.query('SELECT user_id FROM riders WHERE ride_id = $1', [
      created.body.ride.id,
    ]);
    expect(seats.rows).toEqual([{ user_id: owner.id }]);
  });

  it('refuses an invalid offer field by field and stores nothing', async () => {
    const owner = await signedInStudent();
    const refused = await callRoute(createRide, {
      method: 'POST',
      as: owner,
      body: rideOffer({
        hubId: 'hall-4',
        vehicleTypeId: 'helicopter',
        departureStart: inMinutes(30),
        departureEnd: inMinutes(400),
        expectedTotalFare: 0,
      }),
    });

    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe('Validation failed.');
    // Starts too soon, and its window (370 minutes) is longer than three hours.
    expect(Object.keys(refused.body.errors).sort()).toEqual([
      'departureEnd',
      'departureStart',
      'expectedTotalFare',
      'hubId',
      'vehicleTypeId',
    ]);
    expect((await pool.query('SELECT count(*)::int AS n FROM rides')).rows[0].n).toBe(0);
  });

  it('refuses a ride that overlaps or departs within two hours of the owner’s other ride', async () => {
    const owner = await signedInStudent();
    await offerRide(owner, { departureStart: inMinutes(180), departureEnd: inMinutes(240) });

    const overlapping = await callRoute(createRide, {
      method: 'POST',
      as: owner,
      body: rideOffer({ departureStart: inMinutes(200), departureEnd: inMinutes(260) }),
    });
    expect(overlapping.status).toBe(409);

    const tooClose = await callRoute(createRide, {
      method: 'POST',
      as: owner,
      body: rideOffer({ departureStart: inMinutes(250), departureEnd: inMinutes(270) }),
    });
    expect(tooClose.status).toBe(409);
    expect(tooClose.body.code).toBe('departure_conflict');

    const later = await callRoute(createRide, {
      method: 'POST',
      as: owner,
      body: rideOffer({ departureStart: inMinutes(310), departureEnd: inMinutes(330) }),
    });
    expect(later.status).toBe(201);
  });
});

describe('searching for a ride (FR-RD-03, FR-RD-08.1)', () => {
  it('shows an open ride with its seats and the share a new rider would pay', async () => {
    const owner = await signedInStudent({ name: 'Owner Asha' });
    const rider = await signedInStudent();
    const ride = await offerRide(owner, { expectedTotalFare: 601 });

    const results = await searchFor(rider.id);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: ride.id,
      ownerName: 'Owner Asha',
      occupantNames: ['Owner Asha'],
      capacity: 4,
      occupantCount: 1,
      seatsLeft: 3,
      totalFare: 601,
      // ceil(601 / 2)
      estimatedShare: 301,
      requestState: null,
    });
  });

  it('never shows the owner their own ride, nor a rider a ride they are on', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);

    expect(await searchFor(owner.id)).toEqual([]);
    await joinRide(owner, ride.id, rider);
    expect(await searchFor(rider.id)).toEqual([]);
  });

  it('hides rides that are locked, full, or outside the filters', async () => {
    const viewer = await signedInStudent();
    const [nearOwner, fullOwner, autoOwner] = await Promise.all([
      signedInStudent(),
      signedInStudent(),
      signedInStudent(),
    ]);
    const near = await offerRide(nearOwner);
    const full = await offerRide(fullOwner, { vehicleTypeId: 'auto' });
    const open = await offerRide(autoOwner, { vehicleTypeId: 'car', expectedTotalFare: 900 });

    // Departing in 30 minutes: past its lock time.
    await moveDeparture(near.id, 30);
    // Owner plus two riders fill an auto.
    await joinRide(fullOwner, full.id, await signedInStudent());
    await joinRide(fullOwner, full.id, await signedInStudent());

    expect((await searchFor(viewer.id)).map((r) => r.id)).toEqual([open.id]);
    expect(await searchFor(viewer.id, { vehicleTypeId: 'vikram' })).toEqual([]);
    // 900 / 2 = 450 would be the share: above a 400 limit, within a 450 one.
    expect(await searchFor(viewer.id, { maxFareShare: 400 })).toEqual([]);
    expect((await searchFor(viewer.id, { maxFareShare: 450 })).map((r) => r.id)).toEqual([open.id]);
    expect(await searchFor(viewer.id, { hubId: 'bus-stand' })).toEqual([]);
  });

  it('keeps a ride the viewer has asked to join visible with its request state', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    expect((await requestSeat(rider, ride.id)).status).toBe(201);

    const results = await searchFor(rider.id);
    expect(results.map((r) => [r.id, r.requestState])).toEqual([[ride.id, 'pending']]);
  });
});
