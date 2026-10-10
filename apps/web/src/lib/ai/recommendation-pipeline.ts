import "server-only";
import { pool } from "@/lib/db";
import { searchRides, type SearchRideRequest, type SearchRideResult } from "@/lib/ride-search";
import { enrichSharedInterests } from "./shared-interest-enrichment";
import { calculatePickupOrderImpact } from "./pickup-order-impact";
import {
  MAX_RIDE_RECOMMENDATIONS,
  type AiRankedRide,
  type RecommendationCandidate,
  type RideRecommendationResponse,
  type RideSuggestion,
  type RecommendationRequest,
} from "./types";
import { validateAiRanking } from "./validate-ranking";

type PickupStopRow = { ride_id: string; location_name: string };
type AggregateRatingRow = { ride_id: string; average_score: string | number | null; rating_count: string | number };

/** Load only stop labels; occupant identities are not needed for route impact. */
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

/** Aggregate ratings only; never selects comments or individual rating identities. */
async function loadAggregateRatings(
  rideIds: readonly string[],
): Promise<Map<string, RecommendationCandidate["aggregateRating"]>> {
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

function buildCandidate(
  ride: SearchRideResult,
  pickupStops: readonly string[],
  proposedPickupName: string,
  sharedTags: string[] | null,
  aggregateRating: RecommendationCandidate["aggregateRating"],
): RecommendationCandidate {
  const pickupImpact = calculatePickupOrderImpact(pickupStops, proposedPickupName);
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
      stopsByRide.get(ride.id) ?? [],
      proposedPickupName,
      shared?.sharedInterestTags ?? null,
      ratingsByRide.get(ride.id) ?? null,
    );
  });
  return { rides, candidates };
}

export type RankingRunner = (request: RecommendationRequest) => Promise<unknown>;

/** Distance in minutes between two time windows; overlapping windows have distance zero. */
export function departureWindowDistanceMinutes(
  rideStart: string,
  rideEnd: string,
  requestedStart: string,
  requestedEnd: string,
): number {
  const rs = Date.parse(rideStart);
  const re = Date.parse(rideEnd);
  const qs = Date.parse(requestedStart);
  const qe = Date.parse(requestedEnd);
  if (![rs, re, qs, qe].every(Number.isFinite) || rs >= re || qs >= qe) return Number.POSITIVE_INFINITY;
  if (re < qs) return (qs - re) / 60_000;
  if (rs > qe) return (rs - qe) / 60_000;
  return 0;
}

/** Stable fallback order: closest departure window, lowest fare share, then ride ID. */
export function rankFallbackRides(
  rides: readonly SearchRideResult[],
  filters: SearchRideRequest,
): SearchRideResult[] {
  return [...rides].sort((a, b) => {
    const distance = departureWindowDistanceMinutes(
      a.departureStart, a.departureEnd, filters.departureStart, filters.departureEnd,
    ) - departureWindowDistanceMinutes(
      b.departureStart, b.departureEnd, filters.departureStart, filters.departureEnd,
    );
    if (distance !== 0) return distance;
    const fare = a.estimatedShare - b.estimatedShare;
    if (fare !== 0) return fare;
    return a.id.localeCompare(b.id);
  });
}

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
    ranking = validateAiRanking(await runRanking({
      filters: {
        direction: filters.direction,
        departureStart: filters.departureStart,
        departureEnd: filters.departureEnd,
        vehicleTypeId: filters.vehicleTypeId,
        maxFareShare: filters.maxFareShare,
      },
      candidates: initial.candidates,
    }), initial.candidates);
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

  // Deterministic fallback uses only trusted current search fields, never model fields.
  if (!suggestions.length) {
    for (const ride of rankFallbackRides(currentRides, filters).slice(0, MAX_RIDE_RECOMMENDATIONS)) {
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
