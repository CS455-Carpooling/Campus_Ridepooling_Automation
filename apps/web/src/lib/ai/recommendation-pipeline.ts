import "server-only";
import { pool } from "@/lib/db";
import { searchRides, type SearchRideRequest, type SearchRideResult } from "@/lib/ride-search";
import { enrichSharedInterests } from "./shared-interest-enrichment";
import { calculatePickupOrderImpact } from "./pickup-order-impact";
import {
  MAX_RECOMMENDATION_CONS,
  MAX_RECOMMENDATION_PROS,
  MAX_RIDE_RECOMMENDATIONS,
  type AiRankedRide,
  type RecommendationCandidate,
  type RideRecommendationResponse,
  type RideSuggestion,
  type RecommendationRequest,
} from "./types";
import { validateAiRanking } from "./validate-ranking";

function buildCandidate(
  ride: SearchRideResult,
  filters: SearchRideRequest,
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
      filters,
      stopsByRide.get(ride.id) ?? [],
      proposedPickupName,
      shared?.sharedInterestTags ?? null,
      ratingsByRide.get(ride.id) ?? null,
    );
  });
  return { rides, candidates };
}

export type RankingRunner = (request: RecommendationRequest) => Promise<unknown>;

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
