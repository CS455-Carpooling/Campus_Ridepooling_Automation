import { describe, expect, it } from 'vitest';
import { PATCH as manageRide } from '@/app/api/rides/[id]/route';
import { POST as fileComplaint } from '@/app/api/rides/[id]/complaints/route';
import { POST as rate } from '@/app/api/rides/[id]/ratings/route';
import { pool } from '@/lib/db';
import { searchRides } from '@/lib/ride-search';
import { callRoute } from '../http';
import {
  markSeat,
  moveDeparture,
  offerRide,
  pooledRide,
  requestSeat,
  seatsOf,
  signedInStudent,
  tripStep,
} from '../fixtures';

// Adversarial (CS455-113): each rule that depends on the clock, a moment either side of its
// boundary. The app reads the time on every request, so the database is set to the boundary.

/** Completes the ride, then moves its completion `minutesAgo` into the past. */
async function completedMinutesAgo(minutesAgo: number) {
  const trip = await pooledRide({ riders: 1, startsIn: 30 });
  for (const step of ['pickup_in_progress', 'in_transit', 'completed']) {
    expect((await tripStep(trip.owner, trip.ride.id, step)).status).toBe(200);
  }
  await pool.query(
    `UPDATE rides SET completed_at = now() - make_interval(secs => $2::float8 * 60) WHERE id = $1`,
    [trip.ride.id, minutesAgo],
  );
  const [ownerSeat] = await seatsOf(trip.ride.id);
  return { ...trip, ownerSeat: ownerSeat.id };
}

const DAY = 24 * 60;

describe('the lock, an hour before departure (P-06)', () => {
  it.each([
    [60.5, 201, undefined],
    [59.5, 409, 'ride_locked'],
  ])('departing in %s minutes: a seat request answers %s', async (minutes, status, code) => {
    const owner = await signedInStudent();
    const ride = await offerRide(owner);
    await moveDeparture(ride.id, minutes);

    const answer = await requestSeat(await signedInStudent(), ride.id);
    expect([answer.status, answer.body.code]).toEqual([status, code]);
  });

  it('drops a ride from search results at the same minute', async () => {
    const viewer = await signedInStudent();
    const open = await offerRide(await signedInStudent());
    const closing = await offerRide(await signedInStudent());
    await moveDeparture(open.id, 60.5);
    await moveDeparture(closing.id, 59.5);

    const results = await searchRides(viewer.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-2',
      departureStart: new Date(Date.now()).toISOString(),
      departureEnd: new Date(Date.now() + 300 * 60_000).toISOString(),
    });
    expect(results.map((r) => r.id)).toEqual([open.id]);
  });
});

describe('the no-show grace period, five minutes after the agreed pickup (P-19)', () => {
  it.each([
    [4.9, 409, 'grace_period'],
    [5.1, 200, undefined],
  ])('%s minutes after pickup: marking a no-show answers %s', async (minutes, status, code) => {
    const { owner, ride, requestIds } = await pooledRide({ riders: 1, startsIn: 30 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    await pool.query(
      `UPDATE ride_join_requests
       SET current_pickup_at = now() - make_interval(secs => $2::float8 * 60) WHERE id = $1`,
      [requestIds[0], minutes],
    );
    const [, seat] = await seatsOf(ride.id);

    const answer = await markSeat(owner, ride.id, seat.id, 'no_show');
    expect([answer.status, answer.body.code]).toEqual([status, code]);
  });
});

describe('the complaint window, seven days after completion (FR-RD-13.1)', () => {
  it.each([
    ['7 days less a minute', 7 * DAY - 1, 201, undefined],
    ['7 days and a minute', 7 * DAY + 1, 409, 'window_closed'],
  ])('%s after completion: a complaint answers %s', async (_label, minutes, status, code) => {
    const { ride, riders, ownerSeat } = await completedMinutesAgo(minutes);
    const answer = await callRoute(fileComplaint, {
      method: 'POST',
      params: { id: ride.id },
      as: riders[0],
      body: {
        occupantId: ownerSeat,
        category: 'other',
        description: 'Testing the last minute of the complaint window.',
      },
    });
    expect([answer.status, answer.body.code]).toEqual([status, code]);
  });
});

describe('the rating window, 72 hours after completion (P-16)', () => {
  it.each([
    ['72 hours less a minute', 72 * 60 - 1, 201, undefined],
    ['72 hours and a minute', 72 * 60 + 1, 409, 'closed'],
  ])('%s after completion: rating answers %s', async (_label, minutes, status, code) => {
    const { ride, riders, ownerSeat } = await completedMinutesAgo(minutes);
    const answer = await callRoute(rate, {
      method: 'POST',
      params: { id: ride.id },
      as: riders[0],
      body: { ratings: [{ occupantId: ownerSeat, score: 4 }] },
    });
    expect([answer.status, answer.body.code]).toEqual([status, code]);
  });
});

describe('the end of the departure window', () => {
  it.each([
    [59, 200, undefined],
    [61, 409, 'window_over'],
  ])(
    '%s minutes into a one-hour window: cancelling answers %s',
    async (minutesIn, status, code) => {
      const owner = await signedInStudent();
      const ride = await offerRide(owner);
      await moveDeparture(ride.id, -minutesIn);

      const answer = await callRoute(manageRide, {
        method: 'PATCH',
        params: { id: ride.id },
        as: owner,
        body: { action: 'cancel' },
      });
      expect([answer.status, answer.body.code]).toEqual([status, code]);
    },
  );
});
