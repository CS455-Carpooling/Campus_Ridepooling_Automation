import { createHash } from 'node:crypto';

const RIDER_PSEUDONYM_DOMAIN = 'recommendation-rider-v1:';

/** Stable, non-reversible identifier for recommendation audit and feedback ownership checks. */
export function pseudonymizeRecommendationRider(userId: string): string {
  return createHash('sha256').update(`${RIDER_PSEUDONYM_DOMAIN}${userId}`).digest('hex');
}
