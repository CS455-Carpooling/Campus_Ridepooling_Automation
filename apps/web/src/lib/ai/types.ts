import type { SearchRideRequest, SearchRideResult } from '@/lib/ride-search';

/** Factors the recommender may use, subject to availability and consent. */
export type RecommendationFactor =
  | 'fare'
  | 'departure'
  | 'pickup_order'
  | 'shared_interests'
  | 'aggregate_rating'
  | 'vehicle'
  | 'seats'
  | 'trust_indicator';

export type RecommendationSource = 'ai' | 'fallback';
export type RecommendationFeedbackValue = 'helpful' | 'not_helpful';

/**
 * Privacy-filtered, server-computed data allowed in a model request.
 * Do not add display names, contact details, complaint data, or raw profile data.
 * Null means a permitted factor is unavailable; the model must not infer it.
 */
export type RecommendationCandidate = {
  rideId: string;
  estimatedFareShare: number;
  departureStart: string;
  departureEnd: string;
  vehicleType: string;
  availableSeats: number;
  pickupOrderChange: {
    changesPickupOrder: boolean;
    affectedStops: number;
  } | null;
  sharedInterestTags: string[] | null;
  aggregateRating: {
    average: number;
    count: number;
  } | null;
  trustIndicator: boolean | null;
};

/** Model-safe request; candidate values are computed by the application. */
export type RecommendationRequest = {
  filters: Pick<
    SearchRideRequest,
    'direction' | 'departureStart' | 'departureEnd' | 'vehicleTypeId' | 'maxFareShare'
  >;
  candidates: RecommendationCandidate[];
};

/** Untrusted model output: IDs and explanations only, never authoritative ride data. */
export type AiRankedRide = {
  rideId: string;
  factors: RecommendationFactor[];
  pros: string[];
  cons: string[];
};

/** Model ranking output; validate and cap it before displaying any suggestion. */
export type AiRankingResponse = {
  rankedRides: AiRankedRide[];
};

/** Final rider-facing suggestion uses the trusted, current search result. */
export type RideSuggestion = {
  ride: SearchRideResult;
  pros: string[];
  cons: string[];
  factors: RecommendationFactor[];
};

/** Final response after validation or deterministic fallback. */
export type RideRecommendationResponse = {
  source: RecommendationSource;
  suggestions: RideSuggestion[];
  message?: string;
};

/** Internal orchestration input; not the payload sent directly to the model. */
export type RecommendationInput = {
  filters: SearchRideRequest;
  candidates: SearchRideResult[];
};

/** Feedback is associated with a displayed recommendation/ride by the caller. */
export type RecommendationFeedback = {
  requestId: string;
  rideId: string;
  value: RecommendationFeedbackValue;
};

export const MAX_RIDE_RECOMMENDATIONS = 5;
export const MAX_RECOMMENDATION_PROS = 3;
export const MAX_RECOMMENDATION_CONS = 3;

export const RECOMMENDATION_FACTORS: readonly RecommendationFactor[] = [
  'fare',
  'departure',
  'pickup_order',
  'shared_interests',
  'aggregate_rating',
  'vehicle',
  'seats',
  'trust_indicator',
] as const;
