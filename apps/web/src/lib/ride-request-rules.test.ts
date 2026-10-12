
import { describe, expect, it } from 'vitest';
import { validateJoinRequest } from './ride-request-rules';

describe('validateJoinRequest', () => {
  const validInput = {
    pickupPointId: 'hall-1',
    idempotencyKey: '734057ef-0581-4a2e-8527-843e226ef0eb',
  };

  it('accepts a valid pickup point and UUID key', () => {
    const result = validateJoinRequest(validInput);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).toEqual(validInput);
    }
  });

  it('rejects a missing pickup point', () => {
    const result = validateJoinRequest({
      idempotencyKey: validInput.idempotencyKey,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects an empty pickup point', () => {
    const result = validateJoinRequest({
      ...validInput,
      pickupPointId: '   ',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a pickup point longer than 100 characters', () => {
    const result = validateJoinRequest({
      ...validInput,
      pickupPointId: 'a'.repeat(101),
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a missing idempotency key', () => {
    const result = validateJoinRequest({
      pickupPointId: validInput.pickupPointId,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a malformed idempotency key', () => {
    const result = validateJoinRequest({
      ...validInput,
      idempotencyKey: 'not-a-uuid',
    });

    expect(result.ok).toBe(false);
  });

  it('trims whitespace around the pickup point', () => {
    const result = validateJoinRequest({
      ...validInput,
      pickupPointId: '  hall-1  ',
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.pickupPointId).toBe('hall-1');
    }
  });
});
