import type { SearchRideRequest, SearchRideResult } from '@/lib/ride-search';

export type RecommendationFactor = 'fare' | 'departure' | 'vehicle' | 'seats';

export type AiRankedRide = {
  rideId: string;
  factors: RecommendationFactor[];
};

export type RideSuggestion = {
  ride: SearchRideResult;
  pros: string[];
  cons: string[];
  factors: RecommendationFactor[];
};

export type RideRecommendationResponse = {
  source: 'ai' | 'fallback';
  suggestions: RideSuggestion[];
  message?: string;
};

export type RecommendationInput = {
  filters: SearchRideRequest;
  candidates: SearchRideResult[];
};

export const RECOMMENDATION_FACTORS: readonly RecommendationFactor[] = [
  'fare',
  'departure',
  'vehicle',
  'seats',
] as const;
