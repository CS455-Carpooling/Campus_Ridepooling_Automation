import {
  MAX_RECOMMENDATION_CONS,
  MAX_RECOMMENDATION_PROS,
  MAX_RIDE_RECOMMENDATIONS,
  RECOMMENDATION_FACTORS,
  type AiRankedRide,
  type RecommendationCandidate,
  type RecommendationFactor,
} from "./types";

const MAX_EXPLANATION_LENGTH = 180;

function isExplanation(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.trim().length <= MAX_EXPLANATION_LENGTH
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

function availableFactors(candidate: RecommendationCandidate): Set<RecommendationFactor> {
  const factors = new Set<RecommendationFactor>(["fare", "departure", "vehicle", "seats"]);
  if (candidate.pickupOrderChange !== null) factors.add("pickup_order");
  if (candidate.sharedInterestTags !== null) factors.add("shared_interests");
  if (candidate.aggregateRating !== null) factors.add("aggregate_rating");
  if (candidate.trustIndicator !== null) factors.add("trust_indicator");
  return factors;
}

/** Validates untrusted model output; trusted ride details are attached elsewhere. */
export function validateAiRanking(
  raw: unknown,
  eligibleCandidates: readonly RecommendationCandidate[],
): AiRankedRide[] {
  if (!raw || typeof raw !== "object" || !("rankedRides" in raw)) return [];
  const ranked = (raw as { rankedRides?: unknown }).rankedRides;
  if (!Array.isArray(ranked)) return [];

  const eligible = new Map(eligibleCandidates.map((candidate) => [candidate.rideId, candidate]));
  const seen = new Set<string>();
  const validated: AiRankedRide[] = [];

  for (const item of ranked) {
    if (validated.length >= MAX_RIDE_RECOMMENDATIONS) break;
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    if (typeof value.rideId !== "string" || !eligible.has(value.rideId) || seen.has(value.rideId)) continue;
    if (!Array.isArray(value.factors) || !Array.isArray(value.pros) || !Array.isArray(value.cons)) continue;

    const candidate = eligible.get(value.rideId)!;
    const permitted = availableFactors(candidate);
    const factors = [...new Set(value.factors.filter(
      (factor): factor is RecommendationFactor =>
        typeof factor === "string"
        && (RECOMMENDATION_FACTORS as readonly string[]).includes(factor)
        && permitted.has(factor as RecommendationFactor),
    ))];
    if (value.pros.length > MAX_RECOMMENDATION_PROS || value.cons.length > MAX_RECOMMENDATION_CONS) continue;
    if (value.pros.some((text) => !isExplanation(text)) || value.cons.some((text) => !isExplanation(text))) continue;
    const pros = value.pros.map((text) => text.trim());
    const cons = value.cons.map((text) => text.trim());

    seen.add(value.rideId);
    validated.push({ rideId: value.rideId, factors, pros, cons });
  }
  return validated;
}
