import { describe, expect, it } from 'vitest';
import {
  MAX_WAITING_REQUESTS,
  REQUEST_CONFLICT_WINDOW_MS,
  hasDepartureConflict,
  hasMaterialRequestDrift,
  parseJoinRequestInput,
} from './join-request-rules';

const snapshot = {
  departureStart: new Date('2026-10-10T01:00:00.000Z'),
  pickupAt: new Date('2026-10-10T01:10:00.000Z'),
  estimatedShare: 100,
};

describe('join request input', () => {
  it('accepts a pickup point and bounded idempotency key', () => {
    expect(
      parseJoinRequestInput({ pickupLocationId: 'hall-6', idempotencyKey: 'attempt-1' }),
    ).toEqual({ ok: true, value: { pickupLocationId: 'hall-6', idempotencyKey: 'attempt-1' } });
  });

  it('requires both values and bounds their lengths', () => {
    expect(parseJoinRequestInput({ pickupLocationId: '', idempotencyKey: 'x' }).ok).toBe(false);
    expect(
      parseJoinRequestInput({ pickupLocationId: 'hall-6', idempotencyKey: 'x'.repeat(201) }).ok,
    ).toBe(false);
  });
});

describe('D1 request thresholds', () => {
  it('caps waiting requests at three', () => {
    expect(MAX_WAITING_REQUESTS).toBe(3);
  });

  it('uses strict greater-than thresholds for 10-minute and 20-percent drift', () => {
    expect(
      hasMaterialRequestDrift(snapshot, {
        ...snapshot,
        departureStart: new Date(snapshot.departureStart.getTime() + 10 * 60_000),
      }),
    ).toBe(false);
    expect(
      hasMaterialRequestDrift(snapshot, {
        ...snapshot,
        departureStart: new Date(snapshot.departureStart.getTime() + 10 * 60_000 + 1),
      }),
    ).toBe(true);
    expect(hasMaterialRequestDrift(snapshot, { ...snapshot, estimatedShare: 120 })).toBe(false);
    expect(hasMaterialRequestDrift(snapshot, { ...snapshot, estimatedShare: 121 })).toBe(true);
  });

  it('reconfirms on pickup-time movement and only conflicts inside two hours', () => {
    expect(
      hasMaterialRequestDrift(snapshot, {
        ...snapshot,
        pickupAt: new Date(snapshot.pickupAt.getTime() - 10 * 60_000 - 1),
      }),
    ).toBe(true);
    const first = new Date('2026-10-10T01:00:00.000Z');
    expect(
      hasDepartureConflict(first, new Date(first.getTime() + REQUEST_CONFLICT_WINDOW_MS - 1)),
    ).toBe(true);
    expect(
      hasDepartureConflict(first, new Date(first.getTime() + REQUEST_CONFLICT_WINDOW_MS)),
    ).toBe(false);
  });
});
