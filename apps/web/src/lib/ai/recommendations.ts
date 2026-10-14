import 'server-only';
import { randomUUID } from 'node:crypto';
import { pool } from '@/lib/db';
import {
  rankWithGemini,
  GEMINI_MODEL_VERSION,
  GEMINI_PROMPT_VERSION,
  RECOMMENDATION_DEADLINE_MS,
} from './gemini-ranking';
import { rankRideRecommendations } from './recommendation-pipeline';
import { pseudonymizeRecommendationRider } from './recommendation-audit';
import type { SearchRideRequest } from '@/lib/ride-search';
import type { RideRecommendationResponse } from './types';

const withDeadline = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('recommendation_deadline')), ms);
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
  let modelCallAttempted = false;
  let serviceFailed = false;
  const auditState: { outputValidationOutcome: 'passed' | 'failed' | 'not_run' } = {
    outputValidationOutcome: 'not_run',
  };
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let response: RideRecommendationResponse;
  try {
    response = await withDeadline(
      rankRideRecommendations(
        viewerId,
        filters,
        async (request) => {
          modelCallAttempted = true;
          try {
            const raw = await withDeadline(rankWithGemini(request), 8_000);
            if (raw && typeof raw === 'object' && '__usageMetadata' in raw) {
              const usage = (
                raw as { __usageMetadata?: { inputTokens?: unknown; outputTokens?: unknown } }
              ).__usageMetadata;
              inputTokens = typeof usage?.inputTokens === 'number' ? usage.inputTokens : null;
              outputTokens = typeof usage?.outputTokens === 'number' ? usage.outputTokens : null;
              const ranking = { ...(raw as Record<string, unknown>) };
              delete ranking.__usageMetadata;
              return ranking;
            }
            return raw;
          } catch (error) {
            if (error instanceof Error && error.message === 'recommendation_deadline')
              timedOut = true;
            throw error;
          }
        },
        (outcome) => {
          auditState.outputValidationOutcome = outcome;
        },
      ),
      RECOMMENDATION_DEADLINE_MS,
    );
  } catch (error) {
    timedOut = error instanceof Error && error.message === 'recommendation_deadline';
    serviceFailed = !timedOut;
    // A second server-side trusted search gives a useful deterministic result if ranking failed.
    let fallbackSuggestions: RideRecommendationResponse['suggestions'] = [];
    try {
      const { searchRides } = await import('@/lib/ride-search');
      const rides = await searchRides(viewerId, filters);
      const { rankFallbackRides } = await import('./recommendation-pipeline');
      fallbackSuggestions = rankFallbackRides(rides, filters)
        .slice(0, 5)
        .map((ride) => ({
          ride,
          pros: [],
          cons: [],
          factors: ['departure', 'fare', 'vehicle', 'seats'],
        }));
    } catch (error) {
      serviceFailed = true;
      console.error('Recommendation fallback search failed:', error);
    }
    response = {
      source: 'fallback',
      suggestions: fallbackSuggestions,
      message: timedOut
        ? 'AI ranking took too long; showing rides ranked by departure timing and fare.'
        : 'AI ranking was unavailable; showing rides ranked by departure timing and fare.',
    };
  }

  const latencyMs = Math.max(0, Date.now() - started);
  const outcome =
    response.suggestions.length === 0 && !modelCallAttempted && !serviceFailed
      ? 'fallback_no_candidates'
      : response.source === 'ai'
        ? 'ai_validated'
        : auditState.outputValidationOutcome === 'failed'
          ? 'fallback_invalid'
          : serviceFailed
            ? 'fallback_service_error'
            : timedOut
              ? 'fallback_timeout'
              : modelCallAttempted && auditState.outputValidationOutcome === 'not_run'
                ? 'fallback_model_error'
                : 'fallback_service_error';
  const fallbackUsed = response.source === 'fallback';

  try {
    await pool.query(
      "DELETE FROM ride_recommendation_audits WHERE created_at < now() - interval '90 days'",
    );
    await pool.query(
      "DELETE FROM ride_recommendation_rate_events WHERE created_at < now() - interval '1 hour'",
    );
    await pool.query(
      `INSERT INTO ride_recommendation_audits
         (request_id, rider_pseudonym, model_version, prompt_version, outcome,
          output_validation_outcome, fallback_used, tool_calls, suggested_ride_ids,
          latency_ms, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, $8::uuid[], $9, $10, $11)`,
      [
        requestId,
        pseudonymizeRecommendationRider(viewerId),
        GEMINI_MODEL_VERSION,
        GEMINI_PROMPT_VERSION,
        outcome,
        auditState.outputValidationOutcome,
        fallbackUsed,
        response.suggestions.map((item) => item.ride.id),
        latencyMs,
        inputTokens,
        outputTokens,
      ],
    );
  } catch (error) {
    // Recommendation delivery should not fail solely because the audit sink is unavailable.
    console.error('Recommendation audit persistence failed:', error);
  }

  return { ...response, requestId };
}
