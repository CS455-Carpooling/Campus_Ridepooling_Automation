import "server-only";
import { rankWithGemini } from "./gemini-ranking";
import { rankRideRecommendations } from "./recommendation-pipeline";
import type { SearchRideRequest } from "@/lib/ride-search";
import type { RideRecommendationResponse } from "./types";

/**
 * Stable server-side entry point for Ask AI to Suggest.
 * Gemini failures and invalid model responses are handled by the pipeline's
 * deterministic fallback. Call only from an authenticated server context.
 */
export async function getRideRecommendations(
  viewerId: string,
  filters: SearchRideRequest,
): Promise<RideRecommendationResponse> {
  return rankRideRecommendations(viewerId, filters, rankWithGemini);
}
