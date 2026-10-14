import { describe, expect, it } from 'vitest';
import { pseudonymizeRecommendationRider } from './recommendation-audit';

describe('recommendation audit rider pseudonyms', () => {
  it('is stable and does not return the direct rider identifier', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const pseudonym = pseudonymizeRecommendationRider(userId);

    expect(pseudonymizeRecommendationRider(userId)).toBe(pseudonym);
    expect(pseudonym).toMatch(/^[a-f0-9]{64}$/);
    expect(pseudonym).not.toContain(userId);
    expect(pseudonymizeRecommendationRider('another-rider')).not.toBe(pseudonym);
  });
});
