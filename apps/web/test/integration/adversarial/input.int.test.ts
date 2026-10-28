import { describe, expect, it } from 'vitest';
import { POST as submitRequest } from '@/app/api/rides/[id]/requests/route';
import { PATCH as manageRide } from '@/app/api/rides/[id]/route';
import { POST as fileComplaint } from '@/app/api/rides/[id]/complaints/route';
import { POST as createRide } from '@/app/api/rides/route';
import { pool } from '@/lib/db';
import { callRoute } from '../http';
import { offerRide, pooledRide, rideOffer, seatsOf, signedInStudent, tripStep } from '../fixtures';

const count = async (table: string) =>
  (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number;

// Adversarial (CS455-113): bodies and identifiers a client should never send. Each must get a
// clean 4xx, store nothing, and never a 500.
describe('malformed bodies', () => {
  it.each([
    ['broken JSON', '{"direction": "to_hub",'],
    ['a JSON array', '[1, 2, 3]'],
    ['a JSON string', '"ride please"'],
    ['null', 'null'],
    ['an empty body', ''],
  ])('offering a ride with %s is a 400, not a crash', async (_case, body) => {
    const owner = await signedInStudent();
    const answer = await callRoute(createRide, { method: 'POST', as: owner, body });
    expect(answer.status).toBe(400);
    expect(answer.body.error).toBe('Validation failed.');
    expect(await count('rides')).toBe(0);
  });

  it('refuses wrong types instead of coercing them', async () => {
    const owner = await signedInStudent();
    for (const field of [
      { expectedTotalFare: '600' },
      { expectedTotalFare: 600.5 },
      { expectedTotalFare: -1 },
      { direction: 'TO_HUB' },
      { departureStart: 1767225600000 },
      { departureStart: '2026-13-45T25:61:00+05:30' },
      { hubId: ['kanpur-central'] },
    ]) {
      const answer = await callRoute(createRide, {
        method: 'POST',
        as: owner,
        body: rideOffer(field),
      });
      expect([JSON.stringify(field), answer.status]).toEqual([JSON.stringify(field), 400]);
    }
    expect(await count('rides')).toBe(0);
  });

  it('refuses an edit with a string capacity or a non-boolean confirmation', async () => {
    const owner = await signedInStudent();
    const ride = await offerRide(owner);
    const edit = (body: Record<string, unknown>) =>
      callRoute(manageRide, { method: 'PATCH', params: { id: ride.id }, as: owner, body });

    expect((await edit({ action: 'edit', capacity: '3' })).body.code).toBe('invalid_capacity');
    expect((await edit({ action: 'edit', capacity: 2.5 })).body.code).toBe('invalid_capacity');
    expect((await edit({ action: 'edit', departureStart: 'tomorrow' })).body.code).toBe(
      'invalid_departure',
    );
    expect(
      (await edit({ action: 'edit', expectedTotalFare: 700, confirmAffectedRiders: 'yes' })).body
        .code,
    ).toBe('invalid_confirmation');
  });
});

describe('oversized input', () => {
  it('refuses an idempotency key or pickup ID beyond its limit', async () => {
    const ride = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    const ask = (body: Record<string, unknown>) =>
      callRoute(submitRequest, { method: 'POST', params: { id: ride.id }, as: rider, body });

    const longKey = await ask({ pickupLocationId: 'hall-2', idempotencyKey: 'k'.repeat(201) });
    expect([longKey.status, longKey.body.code]).toEqual([400, 'invalid_request']);
    const longPlace = await ask({ pickupLocationId: 'h'.repeat(101), idempotencyKey: 'ok' });
    expect([longPlace.status, longPlace.body.code]).toEqual([400, 'invalid_request']);
    expect(await count('ride_join_requests')).toBe(0);
  });

  it('refuses a complaint description over 2000 characters, and a megabyte of it', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: 30 });
    for (const step of ['pickup_in_progress', 'completed']) {
      expect((await tripStep(owner, ride.id, step)).status).toBe(200);
    }
    const [ownerSeat] = await seatsOf(ride.id);
    for (const size of [2001, 1_000_000]) {
      const answer = await callRoute(fileComplaint, {
        method: 'POST',
        params: { id: ride.id },
        as: riders[0],
        body: { occupantId: ownerSeat.id, category: 'other', description: 'x'.repeat(size) },
      });
      expect([size, answer.status, answer.body.code]).toEqual([size, 400, 'invalid']);
    }
    expect(await count('complaints')).toBe(0);
  });
});

describe('identifiers', () => {
  it.each([
    'not-a-uuid',
    "' OR '1'='1",
    '00000000-0000-0000-0000-000000000000; DROP TABLE rides;--',
    '../../etc/passwd',
  ])('treats the ride ID %j as not found without querying for it', async (id) => {
    const rider = await signedInStudent();
    const answer = await callRoute(submitRequest, {
      method: 'POST',
      params: { id },
      as: rider,
      body: { pickupLocationId: 'hall-2', idempotencyKey: 'k' },
    });
    expect([answer.status, answer.body.code]).toEqual([404, 'not_found']);
  });

  it('answers a well-formed but unknown ride ID with the same 404', async () => {
    const answer = await callRoute(submitRequest, {
      method: 'POST',
      params: { id: crypto.randomUUID() },
      as: await signedInStudent(),
      body: { pickupLocationId: 'hall-2', idempotencyKey: 'k' },
    });
    expect([answer.status, answer.body.code]).toEqual([404, 'not_found']);
  });
});

describe('hostile text', () => {
  it('stores SQL and markup in a complaint as plain text', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: 30 });
    for (const step of ['pickup_in_progress', 'completed']) {
      expect((await tripStep(owner, ride.id, step)).status).toBe(200);
    }
    const [ownerSeat] = await seatsOf(ride.id);
    const description = `'); DROP TABLE rides; -- <script>alert(1)</script> {{7*7}}`;

    const answer = await callRoute(fileComplaint, {
      method: 'POST',
      params: { id: ride.id },
      as: riders[0],
      body: { occupantId: ownerSeat.id, category: 'other', description },
    });
    expect(answer.status).toBe(201);
    const stored = await pool.query('SELECT description FROM complaints');
    expect(stored.rows).toEqual([{ description }]);
    expect(await count('rides')).toBe(1);
  });
});
