import "server-only";
import { pool } from "@/lib/db";
import { searchRides, type SearchRideRequest, type SearchRideResult } from "@/lib/ride-search";
import { enrichSharedInterests } from "./shared-interest-enrichment";
import { calculatePickupOrderImpact } from "./pickup-order-impact";
import {
  MAX_RECOMMENDATION_CONS,
  MAX_RECOMMENDATION_PROS,
  MAX_RIDE_RECOMMENDATIONS,
  RECOMMENDATION_FACTORS,
  type AiRankedRide,
  type RecommendationCandidate,
  type RecommendationFactor,
  type RideRecommendationResponse,
  type RideSuggestion,
} from "./types";

const MAX_EXPLANATION_LENGTH = 180;

type PickupStopRow = { ride_id: string; location_name: string };
type AggregateRatingRow = { ride_id: string; average_score: string | number | null; rating_count: string | number };
/**
 * Loads campus stop names for current occupants, without selecting user IDs or
 * names. The viewer's proposed stop is supplied from the validated search filter.
 */
async function loadExistingStops(rideIds: readonly string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const id of rideIds) result.set(id, []);
  if (!rideIds.length) return result;

  const { rows } = await pool.query<PickupStopRow>(
    `SELECT r.ride_id, l.name AS location_name
       FROM riders r
       JOIN locations l ON l.id = r.campus_location_id AND l.is_active = TRUE
      WHERE r.ride_id = ANY($1::uuid[]) AND r.left_at IS NULL
      ORDER BY r.ride_id, r.joined_at, r.id`,
    [[...new Set(rideIds)]],
  );
  for (const row of rows) {
    const stops = result.get(row.ride_id) ?? [];
    stops.push(row.location_name);
    result.set(row.ride_id, stops);
  }
  return result;
}

/**
 * Aggregate only: no individual rating, comment, rater, or ratee is exposed.
 * A missing aggregate is null, never a fabricated zero rating.
 */
async function loadAggregateRatings(rideIds: readonly string[]): Promise<Map<string, RecommendationCandidate["aggregateRating"]>> {
  const result = new Map<string, RecommendationCandidate["aggregateRating"]>();
  for (const id of rideIds) result.set(id, null);
  if (!rideIds.length) return result;

  const { rows } = await pool.query<AggregateRatingRow>(
    `SELECT r.id AS ride_id,
            AVG(rr.score)::float AS average_score,
            COUNT(rr.id)::int AS rating_count
       FROM rides r
       JOIN riders occupant ON occupant.ride_id = r.id AND occupant.left_at IS NULL
       LEFT JOIN ride_ratings rr
         ON rr.ratee_id = occupant.user_id
        AND rr.ride_id = r.id
      WHERE r.id = ANY($1::uuid[])
      GROUP BY r.id`,
    [[...new Set(rideIds)]],
  );

  for (const row of rows) {
    const count = Number(row.rating_count);
    const average = row.average_score === null ? null : Number(row.average_score);
    result.set(row.ride_id,
      count > 0 && average !== null && Number.isFinite(average)
        ? { average: Math.round(average * 100) / 100, count }
        : null,
    );
  }
  return result;
}

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

/** Rejects unknown/ineligible IDs and sanitizes every model-controlled field. */
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
    const pros = value.pros.filter(isExplanation).map((text) => text.trim()).slice(0, MAX_RECOMMENDATION_PROS);
    const cons = value.cons.filter(isExplanation).map((text) => text.trim()).slice(0, MAX_RECOMMENDATION_CONS);

    // Reject malformed lists instead of silently keeping a partly invalid answer.
    if (value.pros.some((text) => !isExplanation(text)) || value.cons.some((text) => !isExplanation(text))) continue;
    seen.add(value.rideId);
    validated.push({ rideId: value.rideId, factors, pros, cons });
  }
  return validated;
}

function buildCandidate(
  ride: SearchRideResult,
  filters: SearchRideRequest,
  pickupStops: readonly string[],
  proposedPickupName: string,
  sharedTags: string[] | null,
  aggregateRating: RecommendationCandidate["aggregateRating"],
): RecommendationCandidate {
  const pickupImpact = calculatePickupOrderImpact(pickupStops, proposedPickupName);
  const departureStart = Date.parse(ride.departureStart);
  const departureEnd = Date.parse(ride.departureEnd);
  const requestedStart = Date.parse(filters.departureStart);
  const requestedEnd = Date.parse(filters.departureEnd);
  const overlaps = [departureStart, departureEnd, requestedStart, requestedEnd].every(Number.isFinite)
    && departureStart < requestedEnd
    && departureEnd > requestedStart;

  return {
    rideId: ride.id,
    estimatedFareShare: ride.estimatedShare,
    departureStart: ride.departureStart,
    departureEnd: ride.departureEnd,
    vehicleType: ride.vehicleName,
    availableSeats: ride.seatsLeft,
    pickupOrderChange: pickupImpact
      ? { changesPickupOrder: pickupImpact.changesPickupOrder, affectedStops: pickupImpact.affectedStops }
      : null,
    sharedInterestTags: sharedTags,
    aggregateRating,
    // There is no trustworthy, defined trust-indicator source in the current
    // schema, so do not infer or manufacture one.
    trustIndicator: null,
  };
}

export type EnrichedRecommendationCandidates = {
  rides: SearchRideResult[];
  candidates: RecommendationCandidate[];
};

/** Runs trusted search and enriches each eligible candidate with model-safe data. */
export async function buildRecommendationCandidates(
  viewerId: string,
  filters: SearchRideRequest,
): Promise<EnrichedRecommendationCandidates> {
  const rides = await searchRides(viewerId, filters);
  if (!rides.length) return { rides: [], candidates: [] };

  const ids = rides.map((ride) => ride.id);
  const [stopsByRide, sharedByRide, ratingsByRide, proposedPickup] = await Promise.all([
    loadExistingStops(ids),
    enrichSharedInterests(viewerId, ids),
    loadAggregateRatings(ids),
    pool.query<{ name: string }>(
      "SELECT name FROM locations WHERE id = $1 AND type = $2 AND is_active = TRUE",
      [filters.campusLocationId, "campus"],
    ),
  ]);

  const proposedPickupName = proposedPickup.rows[0]?.name ?? "";
  const candidates = rides.map((ride) => {
    const shared = sharedByRide.get(ride.id);
    return buildCandidate(
      ride,
      filters,
      stopsByRide.get(ride.id) ?? [],
      proposedPickupName,
      shared?.sharedInterestTags ?? null,
      ratingsByRide.get(ride.id) ?? null,
    );
  });
  return { rides, candidates };
}

export type RankingRunner = (candidates: readonly RecommendationCandidate[]) => Promise<unknown>;

/**
 * Validates untrusted ranking output, then re-runs the authoritative search
 * immediately before returning. Only current search results are returned as
 * ride details; model output can never overwrite fare, seats, or ride fields.
 */
export async function rankRideRecommendations(
  viewerId: string,
  filters: SearchRideRequest,
  runRanking: RankingRunner,
): Promise<RideRecommendationResponse> {
  const initial = await buildRecommendationCandidates(viewerId, filters);
  if (!initial.rides.length) {
    return { source: "fallback", suggestions: [], message: "No eligible rides match these filters." };
  }

  let ranking: AiRankedRide[] = [];
  try {
    ranking = validateAiRanking(await runRanking(initial.candidates), initial.candidates);
  } catch {
    ranking = [];
  }

  const currentRides = await searchRides(viewerId, filters);
  const currentById = new Map(currentRides.map((ride) => [ride.id, ride]));
  const initialById = new Map(initial.rides.map((ride) => [ride.id, ride]));
  const suggestions: RideSuggestion[] = [];
  const used = new Set<string>();

  for (const item of ranking) {
    const ride = currentById.get(item.rideId);
    if (!ride || !initialById.has(item.rideId) || used.has(item.rideId)) continue;
    used.add(item.rideId);
    suggestions.push({ ride, pros: item.pros, cons: item.cons, factors: item.factors });
    if (suggestions.length >= MAX_RIDE_RECOMMENDATIONS) break;
  }

  // Deterministic fallback uses trusted current search order, never model fields.
  if (!suggestions.length) {
    for (const ride of currentRides.slice(0, MAX_RIDE_RECOMMENDATIONS)) {
      suggestions.push({
        ride,
        pros: [],
        cons: [],
        factors: ["fare", "departure", "vehicle", "seats"],
      });
    }
    return {
      source: "fallback",
      suggestions,
      message: "AI ranking was unavailable or invalid; showing eligible rides in the default order.",
    };
  }

  return { source: "ai", suggestions };
}
