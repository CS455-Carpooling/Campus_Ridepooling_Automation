import "server-only";
import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";
import { rankWithGemini, GEMINI_MODEL_VERSION, GEMINI_PROMPT_VERSION, RECOMMENDATION_DEADLINE_MS } from "./gemini-ranking";
import { rankRideRecommendations } from "./recommendation-pipeline";
import type { SearchRideRequest } from "@/lib/ride-search";
import type { RideRecommendationResponse } from "./types";

const withDeadline = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("recommendation_deadline")), ms);
      // Ensure the timer does not keep the process alive after a successful result.
      promise.finally(() => clearTimeout(timer)).catch(() => undefined);
    }),
  ]);

/** Authenticated entry point; audit rows never include filters, candidate data or profiles. */
export async function getRideRecommendations(
  viewerId: string,
  filters: SearchRideRequest,
): Promise<RideRecommendationResponse> {
  const requestId = randomUUID();
  const started = Date.now();
  let timedOut = false;
  let response: RideRecommendationResponse;
  try {
    response = await withDeadline(
      rankRideRecommendations(viewerId, filters, (request) =>
        withDeadline(rankWithGemini(request), 8_000)),
      RECOMMENDATION_DEADLINE_MS,
    );
  } catch (error) {
    timedOut = error instanceof Error && error.message === "recommendation_deadline";
    // A second server-side trusted search gives a useful deterministic result if ranking failed.
    const { searchRides } = await import("@/lib/ride-search");
    const rides = await searchRides(viewerId, filters);
    const { rankFallbackRides } = await import("./recommendation-pipeline");
    response = {
      source: "fallback",
      suggestions: rankFallbackRides(rides, filters).slice(0, 5).map((ride) => ({
        ride, pros: [], cons: [], factors: ["departure", "fare", "vehicle", "seats"],
      })),
      message: timedOut
        ? "AI ranking took too long; showing rides ranked by departure timing and fare."
        : "AI ranking was unavailable; showing rides ranked by departure timing and fare.",
    };
  }

  const latencyMs = Math.max(0, Date.now() - started);
  const outcome = response.suggestions.length === 0
    ? "fallback_no_candidates"
    : response.source === "ai"
      ? "ai_validated"
      : timedOut ? "fallback_timeout" : "fallback_model_error";

  try {
    await pool.query('DELETE FROM ride_recommendation_audits WHERE created_at < now() - interval \'90 days\'');
    await pool.query('DELETE FROM ride_recommendation_rate_events WHERE created_at < now() - interval \'1 hour\'');
    await pool.query(
      `INSERT INTO ride_recommendation_audits
         (request_id, user_id, model_version, prompt_version, outcome, suggested_ride_ids, latency_ms, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7, NULL, NULL)`,
      [requestId, viewerId, GEMINI_MODEL_VERSION, GEMINI_PROMPT_VERSION, outcome, response.suggestions.map((item) => item.ride.id), latencyMs],
    );
  } catch {
    // Recommendation delivery should not fail solely because the audit sink is unavailable.
    console.error("Recommendation audit persistence failed.");
  }

  return { ...response, requestId };
}
