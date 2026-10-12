// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
}));

vi.mock('./auth', () => ({
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('./db', () => ({ pool: { connect: h.connect } }));

import { runTripChange } from './trip-api';

const messages = { not_owner: 'Only the owner.', grace_period: 'Wait for the grace period.' };
const body = (value: { id: string }) => ({ ride: value });
const statements = () => h.query.mock.calls.map(([sql]) => sql);

beforeEach(() => {
  vi.clearAllMocks();
  h.connect.mockResolvedValue({ query: h.query, release: h.release });
  h.query.mockResolvedValue({ rows: [] });
});

describe('runTripChange', () => {
  it('commits a change that is done and answers it', async () => {
    const response = await runTripChange(
      'Test',
      messages,
      async () => ({ kind: 'done', value: { id: 'r1' } }),
      body,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ride: { id: 'r1' } });
    expect(statements()).toEqual(['BEGIN', 'COMMIT']);
    expect(h.release).toHaveBeenCalled();
  });

  it('rolls back anything else and answers 404 for no ride or no seat', async () => {
    const ride = await runTripChange('Test', messages, async () => ({ kind: 'not_found' }), body);
    expect(ride.status).toBe(404);
    expect(await ride.json()).toEqual({ error: 'Ride not found.', code: 'not_found' });
    const seat = await runTripChange(
      'Test',
      messages,
      async () => ({ kind: 'seat_not_found' }),
      body,
    );
    expect(seat.status).toBe(404);
    expect(await seat.json()).toMatchObject({ code: 'seat_not_found' });
    expect(statements()).toEqual(['BEGIN', 'ROLLBACK', 'BEGIN', 'ROLLBACK']);
  });

  it('answers 403 to someone who is not the owner, 409 otherwise, with the reason', async () => {
    const owner = await runTripChange(
      'Test',
      messages,
      async () => ({ kind: 'refused', code: 'not_owner' }),
      body,
    );
    expect(owner.status).toBe(403);
    expect(await owner.json()).toEqual({ error: 'Only the owner.', code: 'not_owner' });

    const grace = await runTripChange(
      'Test',
      messages,
      async () => ({
        kind: 'refused',
        code: 'grace_period',
        availableAt: '2026-10-13T12:39:00.000Z',
      }),
      body,
    );
    expect(grace.status).toBe(409);
    expect(await grace.json()).toEqual({
      error: 'Wait for the grace period.',
      code: 'grace_period',
      availableAt: '2026-10-13T12:39:00.000Z',
    });

    const other = await runTripChange(
      'Test',
      messages,
      async () => ({ kind: 'refused', code: 'cancelled' }),
      body,
    );
    expect(await other.json()).toEqual({ error: 'This cannot be done now.', code: 'cancelled' });
  });

  it('rolls back, releases the connection and answers 500 without details when it fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await runTripChange(
      'Test',
      messages,
      async () => {
        throw new Error('connection reset');
      },
      body,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Unable to update the trip right now.',
      code: 'server_error',
    });
    expect(statements()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(h.release).toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('Test failed:', expect.any(Error));
    logged.mockRestore();
  });

  it('can answer another success status and name what was not found (CS455-64)', async () => {
    const created = await runTripChange(
      'Test',
      messages,
      async () => ({ kind: 'done', value: { id: 'i1' } }),
      body,
      { status: () => 201 },
    );
    expect(created.status).toBe(201);
    const missing = await runTripChange(
      'Test',
      messages,
      async () => ({ kind: 'not_found' }),
      body,
      { notFound: 'SOS alert not found.' },
    );
    expect(await missing.json()).toEqual({ error: 'SOS alert not found.', code: 'not_found' });
  });

  it('answers 500 when no connection can be had', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.connect.mockRejectedValue(new Error('pool exhausted'));
    const response = await runTripChange(
      'Test',
      messages,
      async () => ({ kind: 'not_found' }),
      body,
    );
    expect(response.status).toBe(500);
    expect(h.release).not.toHaveBeenCalled();
    logged.mockRestore();
  });
});
