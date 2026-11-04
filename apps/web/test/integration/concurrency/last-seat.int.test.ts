import { describe, expect, it } from 'vitest';
import { pool } from '@/lib/db';
import type { RouteResult } from '../http';
import {
  actOnRequest,
  joinRide,
  offerRide,
  requestRow,
  requestSeat,
  signedInStudent,
} from '../fixtures';

const ITERATIONS = 100;
const ACCEPTORS_PER_ROUND = 49;
const CONCURRENT_OPERATIONS_PER_ROUND = ACCEPTORS_PER_ROUND + 1;

type Student = Awaited<ReturnType<typeof signedInStudent>>;
type Occupancy = {
  capacity: number;
  occupants: number;
  acceptedRequests: number;
  availableSeats: number;
};

async function occupancyOf(rideId: string): Promise<Occupancy> {
  const { rows } = await pool.query<{
    capacity: number;
    occupants: number;
    accepted_requests: number;
  }>(
    `SELECT
       ride.capacity_snapshot AS capacity,
       (SELECT count(*)::int FROM riders
        WHERE ride_id = ride.id AND left_at IS NULL) AS occupants,
       (SELECT count(*)::int FROM ride_join_requests
        WHERE ride_id = ride.id AND status = 'accepted') AS accepted_requests
     FROM rides ride
     WHERE ride.id = $1`,
    [rideId],
  );
  const row = rows[0];
  if (!row) throw new Error(`Ride ${rideId} disappeared during the concurrency test.`);
  return {
    capacity: row.capacity,
    occupants: row.occupants,
    acceptedRequests: row.accepted_requests,
    availableSeats: row.capacity - row.occupants,
  };
}

function assertCapacityInvariant(snapshot: Occupancy) {
  expect(snapshot.occupants).toBeLessThanOrEqual(snapshot.capacity);
  expect(snapshot.occupants).toBeGreaterThanOrEqual(1);
  expect(snapshot.availableSeats).toBe(snapshot.capacity - snapshot.occupants);
  // The owner occupies one seat; every other active seat must have one accepted request.
  expect(snapshot.occupants).toBe(1 + snapshot.acceptedRequests);
}

async function ensurePendingRequest(
  rider: Student,
  rideId: string,
  requestIds: Map<string, string>,
): Promise<string> {
  const existingId = requestIds.get(rider.id);
  if (existingId) {
    const existing = await requestRow(existingId);
    if (existing.status === 'pending') return existingId;
    if (existing.status === 'needs_reconfirmation') {
      const reconfirmed = await actOnRequest(rider, rideId, existingId, 'reconfirm');
      expect(reconfirmed.status).toBe(200);
      expect((await requestRow(existingId)).status).toBe('pending');
      return existingId;
    }
    if (existing.status === 'accepted') {
      throw new Error(`Rider ${rider.id} is accepted but was selected as an acceptor.`);
    }
    // A request that was accepted and subsequently left is terminal. The same rider may ask
    // again, so create a fresh request for the next round.
  }

  const created = await requestSeat(rider, rideId);
  expect(created.status).toBe(201);
  const requestId = created.body.request.requestId as string;
  requestIds.set(rider.id, requestId);
  return requestId;
}

async function runAndObserve(
  rideId: string,
  operation: Promise<RouteResult>,
) {
  const result = await operation;
  // Each route promise resolves only after its transaction has committed or rolled back.
  // The following read therefore checks a committed state, not an uncommitted intermediate.
  const snapshot = await occupancyOf(rideId);
  return { result, snapshot };
}

describe('NFR-RD-05: repeated last-seat concurrency experiment', () => {
  it(
    'preserves capacity across 100 rounds of 49 acceptances racing with one leave',
    async () => {
      const owner = await signedInStudent();

      // The auto has capacity three. The owner and this rider occupy two seats, leaving exactly
      // one available seat before every measured round.
      const riders = await Promise.all(
        Array.from({ length: ACCEPTORS_PER_ROUND + 1 }, () => signedInStudent()),
      );
      const ride = await offerRide(owner, {
        vehicleTypeId: 'auto',
        direction: 'from_hub',
        expectedTotalFare: 1,
      });
      let activeRider = riders[0];
      let activeRequestId = await joinRide(owner, ride.id, activeRider);
      const requestIds = new Map<string, string>([[activeRider.id, activeRequestId]]);

      const initial = await occupancyOf(ride.id);
      expect(initial).toMatchObject({ capacity: 3, occupants: 2, availableSeats: 1 });
      assertCapacityInvariant(initial);

      let maximumObservedOccupants = initial.occupants;
      let totalAcceptedInRaces = 0;
      let serialCleanupLeaves = 0;
      const roundSummaries: Array<{ round: number; accepted: number; maxOccupants: number }> = [];

      for (let round = 1; round <= ITERATIONS; round += 1) {
        const acceptors = riders.filter((rider) => rider.id !== activeRider.id);
        expect(acceptors).toHaveLength(ACCEPTORS_PER_ROUND);

        // Prepare 49 distinct pending requests. A request left in a previous round is replaced;
        // pending requests are reused, and any request requiring reconfirmation is reconfirmed.
        const pendingRequestIds = await Promise.all(
          acceptors.map((rider) => ensurePendingRequest(rider, ride.id, requestIds)),
        );

        const concurrent = [
          ...acceptors.map((rider, index) =>
            runAndObserve(
              ride.id,
              actOnRequest(owner, ride.id, pendingRequestIds[index], 'accept'),
            ),
          ),
          runAndObserve(
            ride.id,
            actOnRequest(activeRider, ride.id, activeRequestId, 'leave'),
          ),
        ];

        const settled = await Promise.allSettled(concurrent);
        const rejected = settled.filter((entry) => entry.status === 'rejected');
        expect(rejected, `round ${round} had failed operations`).toHaveLength(0);

        const observations = settled.map((entry) => {
          if (entry.status !== 'fulfilled') throw entry.reason;
          return entry.value;
        });
        for (const observation of observations) {
          assertCapacityInvariant(observation.snapshot);
          maximumObservedOccupants = Math.max(
            maximumObservedOccupants,
            observation.snapshot.occupants,
          );
        }

        const acceptResults = observations.slice(0, ACCEPTORS_PER_ROUND);
        const leaveResult = observations[ACCEPTORS_PER_ROUND].result;
        expect(leaveResult.status, `round ${round} leave`).toBe(200);
        expect(leaveResult.body.result.kind).toBe('left');

        const accepted = acceptResults
          .map((observation, index) => ({
            rider: acceptors[index],
            requestId: pendingRequestIds[index],
            result: observation.result,
          }))
          .filter((entry) => entry.result.status === 200);

        // The leave frees one seat; the ride had one free seat already. Thus one or two
        // acceptances can commit, depending on lock acquisition order, but never more than two.
        expect(accepted.length, `round ${round} accepted count`).toBeGreaterThanOrEqual(1);
        expect(accepted.length, `round ${round} accepted count`).toBeLessThanOrEqual(2);

        for (const entry of acceptResults) {
          if (entry.result.status === 409) {
            expect(entry.result.body.code).toBe('ride_full');
          } else {
            expect(entry.result.status).toBe(200);
            expect(entry.result.body.result.kind).toBe('accepted');
          }
        }

        totalAcceptedInRaces += accepted.length;

        // If the leave ran first, two acceptances may use the two free seats. Leave one of those
        // new occupants serially so the next round again begins with exactly one free seat.
        if (accepted.length === 2) {
          const cleanup = await actOnRequest(
            accepted[1].rider,
            ride.id,
            accepted[1].requestId,
            'leave',
          );
          expect(cleanup.status).toBe(200);
          expect(cleanup.body.result.kind).toBe('left');
          serialCleanupLeaves += 1;
        }

        activeRider = accepted[0].rider;
        activeRequestId = accepted[0].requestId;

        const endOfRound = await occupancyOf(ride.id);
        assertCapacityInvariant(endOfRound);
        expect(endOfRound).toMatchObject({
          capacity: 3,
          occupants: 2,
          availableSeats: 1,
        });
        maximumObservedOccupants = Math.max(maximumObservedOccupants, endOfRound.occupants);
        roundSummaries.push({
          round,
          accepted: accepted.length,
          maxOccupants: Math.max(...observations.map((entry) => entry.snapshot.occupants)),
        });
      }

      expect(roundSummaries).toHaveLength(ITERATIONS);
      expect(totalAcceptedInRaces).toBeGreaterThanOrEqual(ITERATIONS);
      expect(totalAcceptedInRaces).toBeLessThanOrEqual(2 * ITERATIONS);
      expect(maximumObservedOccupants).toBeLessThanOrEqual(3);

      console.info(
        '[NFR-RD-05 concurrency results]',
        JSON.stringify({
          iterations: ITERATIONS,
          concurrentOperationsPerRound: CONCURRENT_OPERATIONS_PER_ROUND,
          concurrentAcceptanceAttempts: ITERATIONS * ACCEPTORS_PER_ROUND,
          concurrentLeaveOperations: ITERATIONS,
          totalConcurrentOperations: ITERATIONS * CONCURRENT_OPERATIONS_PER_ROUND,
          acceptedInConcurrentRounds: totalAcceptedInRaces,
          serialCleanupLeaves,
          maximumObservedOccupants,
          capacity: 3,
          invariantViolations: 0,
        }),
      );
    },
    300_000,
  );

  it('serializes direct database writers and rejects an over-capacity insert', async () => {
    const owner = await signedInStudent();
    const seatedRider = await signedInStudent();
    const firstExtraRider = await signedInStudent();
    const secondExtraRider = await signedInStudent();
    const ride = await offerRide(owner, { vehicleTypeId: 'auto' });
    await joinRide(owner, ride.id, seatedRider);

    const writes = await Promise.allSettled([
      pool.query(
        `INSERT INTO riders (ride_id, user_id, campus_location_id)
         VALUES ($1, $2, 'hall-2')`,
        [ride.id, firstExtraRider.id],
      ),
      pool.query(
        `INSERT INTO riders (ride_id, user_id, campus_location_id)
         VALUES ($1, $2, 'hall-2')`,
        [ride.id, secondExtraRider.id],
      ),
    ]);

    expect(writes.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    const rejectedWrite = writes.find((entry) => entry.status === 'rejected');
    expect(rejectedWrite?.status).toBe('rejected');
    if (rejectedWrite?.status === 'rejected') {
      expect(rejectedWrite.reason).toMatchObject({
        code: '23514',
        constraint: 'riders_ride_capacity',
      });
    }

    const final = await occupancyOf(ride.id);
    expect(final).toMatchObject({ capacity: 3, occupants: 3, availableSeats: 0 });
    expect(final.occupants).toBeLessThanOrEqual(final.capacity);
  });
});
