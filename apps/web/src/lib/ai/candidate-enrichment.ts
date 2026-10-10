import "server-only";
import { pool } from "@/lib/db";
import { searchRides, type SearchRideRequest, type SearchRideResult } from "@/lib/ride-search";
import { calculatePickupOrderImpact } from "./pickup-order-impact";
import { enrichSharedInterests } from "./shared-interest-enrichment";
import {
  MAX_RECOMMENDATION_CONS,
  MAX_RECOMMENDATION_PROS,
  MAX_RIDE_RECOMMENDATIONS,
  RECOMMENDATION_FACTORS,
  type AiRankedRide,
  type RecommendationCandidate,
  type RecommendationFactor,
} from "./types";

const MAX_EXPLANATION_LENGTH = 160;
const MAX_MODEL_ITEMS = 50;

type CandidateContextRow = {
  ride_id: string;
  campus_location_name: string;
  aggregate_average: number | string | null;
  aggregate_count: number | string | null;
};

export type EnrichedRecommendationCandidates = {
  /** The only candidate data intended for the model. */
  modelCandidates: RecommendationCandidate[];
  /** Trusted search results kept server-side for rendering after validation. */
  trustedRides: Map<string, SearchRideResult>;
};

/**
 * Builds model-safe candidates from fresh search results. The returned
 * SearchRideResult objects remain separate and must never be replaced by
 * model-generated fields.
 */
export async function buildRecommendationCandidates(
  viewerId: string,
  filters: SearchRideRequest,
): Promise<EnrichedRecommendationCandidates> {
  const rides = await searchRides(viewerId, filters);
  const trustedRides = new Map(rides.map((ride) => [ride.id, ride]));
  if (!rides.length) return { modelCandidates: [], trustedRides };

  const rideIds = rides.map((ride) => ride.id);
  const [contextResult, sharedInterests] = await Promise.all([
    pool.query<CandidateContextRow>(
      `
        SELECT
          r.id AS ride_id,
          COALESCE(
            array_agg(DISTINCT loc.name) FILTER (WHERE loc.name IS NOT NULL)
              ->> 0,
            ''
          ) AS campus_location_name,
          ratings.average AS aggregate_average,
          ratings.rating_count AS aggregate_count
        FROM rides r
        JOIN riders occupant ON occupant.ride_id = r.id AND occupant.left_at IS NULL
        LEFT JOIN locations loc ON loc.id = occupant.campus_location_id
        LEFT JOIN LATERAL (
          SELECT
            AVG(rr.score)::numeric(4,2) AS average,
            COUNT(rr.id)::int AS rating_count
          FROM ride_ratings rr
          JOIN riders rated_occupant
            ON rated_occupant.ride_id = r.id
           AND rated_occupant.user_id = rr.ratee_id
           AND rated_occupant.left_at IS NULL
          WHERE rr.ratee_id = rated_occupant.user_id
        ) ratings ON TRUE
        WHERE r.id = ANY($1::uuid[])
        GROUP BY r.id, ratings.average, ratings.rating_count
      `,
      [rideIds],
    ),
    enrichSharedInterests(viewerId, rideIds),
  ]);

  // Use all occupant pickup/drop-off locations, not names, in the route estimate.
  const stopsResult = await pool.query<{ ride_id: string; location_name: string }>(
    `
      SELECT r.ride_id, l.name AS location_name
      FROM riders r
      JOIN locations l ON l.id = r.campus_location_id
      WHERE r.ride_id = ANY($1::uuid[])
        AND r.left_at IS NULL
      ORDER BY r.ride_id, r.joined_at, r.id
    `,
    [rideIds],
  );
  const stopsByRide = new Map<string, string[]>();
  for (const row of stopsResult.rows) {
    const stops = stopsByRide.get(row.ride_id) ?? [];
    stops.push(row.location_name);
    stopsByRide.set(row.ride_id, stops);
  }
  const contextByRide = new Map(contextResult.rows.map((row) => [row.ride_id, row]));

  const modelCandidates = rides.map((ride): RecommendationCandidate => {
    const context = contextByRide.get(ride.id);
    const pickup = calculatePickupOrderImpact(
      stopsByRide.get(ride.id) ?? [ride.campusLocationName],
      // The search request's campus location is an ID; resolve it through the DB below.
      filters.campusLocationId,
    );
    const shared = sharedInterests.get(ride.id)?.sharedInterestTags ?? null;
    const average = context?.aggregate_average == null ? null : Number(context.aggregate_average);
    const count = context?.aggregate_count == null ? 0 : Number(context.aggregate_count);

    return {
      rideId: ride.id,
      // Reuse the application's existing estimateShare result; do not recalculate fare in the model.
      estimatedFareShare: ride.estimatedShare,
      departureStart: ride.departureStart,
      departureEnd: ride.departureEnd,
      vehicleType: ride.vehicleName,
      availableSeats: ride.seatsLeft,
      pickupOrderChange: pickup
        ? { changesPickupOrder: pickup.changesPickupOrder, affectedStops: pickup.affectedStops }
        : null,
      sharedInterestTags: shared,
      aggregateRating: average !== null && count > 0 ? { average, count } : null,
      // No defined trust metric exists in the current schema, so do not invent one.
      trustIndicator: null,
    };
  });

  return { modelCandidates, trustedRides };
}

export type ValidatedRanking = {
  rankedRides: AiRankedRide[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanExplanations(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value.slice(0, max)) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text || text.length > MAX_EXPLANATION_LENGTH) continue;
    if (!result.includes(text)) result.push(text);
  }
  return result;
}

/** Validate untrusted model output against the exact candidate payload. */
export function validateAiRankingResponse(
  raw: unknown,
  candidates: readonly RecommendationCandidate[],
): ValidatedRanking {
  if (!isRecord(raw) || !Array.isArray(raw.rankedRides)) return { rankedRides: [] };
  const eligible = new Map(candidates.map((candidate) => [candidate.rideId, candidate]));
  const allowedFactors = new Set<string>(RECOMMENDATION_FACTORS);
  const seen = new Set<string>();
  const rankedRides: AiRankedRide[] = [];

  for (const item of raw.rankedRides.slice(0, MAX_MODEL_ITEMS)) {
    if (!isRecord(item) || typeof item.rideId !== "string") continue;
    const rideId = item.rideId;
    const candidate = eligible.get(rideId);
    if (!candidate || seen.has(rideId)) continue;
    seen.add(rideId);

    const factors: RecommendationFactor[] = [];
    if (Array.isArray(item.factors)) {
      for (const factor of item.factors) {
        if (typeof factor !== "string" || !allowedFactors.has(factor)) continue;
        if (factors.includes(factor as RecommendationFactor)) continue;
        if (!factorAvailable(candidate, factor as RecommendationFactor)) continue;
        factors.push(factor as RecommendationFactor);
      }
    }

    rankedRides.push({
      rideId,
      factors,
      pros: cleanExplanations(item.pros, MAX_RECOMMENDATION_PROS),
      cons: cleanExplanations(item.cons, MAX_RECOMMENDATION_CONS),
    });
    if (rankedRides.length >= MAX_RIDE_RECOMMENDATIONS) break;
  }
  return { rankedRides };
}

function factorAvailable(candidate: RecommendationCandidate, factor: RecommendationFactor): boolean {
  switch (factor) {
    case "fare": return Number.isFinite(candidate.estimatedFareShare) && candidate.estimatedFareShare >= 0;
    case "departure": return Boolean(candidate.departureStart && candidate.departureEnd);
    case "pickup_order": return candidate.pickupOrderChange !== null;
    case "shared_interests": return candidate.sharedInterestTags !== null;
    case "aggregate_rating": return candidate.aggregateRating !== null;
    case "vehicle": return Boolean(candidate.vehicleType);
    case "seats": return Number.isInteger(candidate.availableSeats) && candidate.availableSeats > 0;
    case "trust_indicator": return candidate.trustIndicator !== null;
  }
}

/**
 * Re-fetches matching rides immediately before returning recommendations.
 * Anything no longer eligible is discarded; trusted current search results
 * replace model-supplied ride data.
 */
export async function recheckRecommendationAvailability(
  viewerId: string,
  filters: SearchRideRequest,
  ranking: ValidatedRanking,
): Promise<{ ride: SearchRideResult; factors: RecommendationFactor[]; pros: string[]; cons: string[] }[]> {
  if (!ranking.rankedRides.length) return [];
  const current = await searchRides(viewerId, filters);
  const currentById = new Map(current.map((ride) => [ride.id, ride]));
  return ranking.rankedRides.flatMap((ranked) => {
    const ride = currentById.get(ranked.rideId);
    return ride ? [{ ride, factors: ranked.factors, pros: ranked.pros, cons: ranked.cons }] : [];
  }).slice(0, MAX_RIDE_RECOMMENDATIONS);
}
