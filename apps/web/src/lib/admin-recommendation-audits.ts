import 'server-only';
import { pool } from './db';

type ReportRow = {
  id: string;
  ride_id: string;
  reason: 'wrong' | 'inappropriate';
  created_at: string;
};

type RecommendationAuditRow = {
  request_id: string;
  rider_pseudonym: string;
  model_version: string;
  prompt_version: string;
  outcome: string;
  output_validation_outcome: 'passed' | 'failed' | 'not_run';
  fallback_used: boolean;
  tool_call_count: number;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: Date;
  reports: ReportRow[] | null;
};

export type RecommendationAudit = {
  requestId: string;
  riderPseudonym: string;
  modelVersion: string;
  promptVersion: string;
  outcome: string;
  validationOutcome: RecommendationAuditRow['output_validation_outcome'];
  fallbackUsed: boolean;
  toolCallCount: number;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  reports: { id: string; rideId: string; reason: ReportRow['reason']; createdAt: string }[];
};

/** Recent recommendation audit records only; report entries remain attached to their request. */
export async function listRecommendationAudits(): Promise<RecommendationAudit[]> {
  const { rows } = await pool.query<RecommendationAuditRow>(
    `SELECT a.request_id, a.rider_pseudonym, a.model_version, a.prompt_version,
            a.outcome, a.output_validation_outcome, a.fallback_used,
            jsonb_array_length(a.tool_calls) AS tool_call_count,
            a.latency_ms, a.input_tokens, a.output_tokens, a.created_at,
            reports.entries
       FROM ride_recommendation_audits a
       LEFT JOIN LATERAL (
         SELECT json_agg(
                  json_build_object(
                    'id', r.id,
                    'ride_id', r.ride_id,
                    'reason', r.reason,
                    'created_at', r.created_at
                  ) ORDER BY r.created_at
                ) AS entries
           FROM ride_recommendation_reports r
          WHERE r.request_id = a.request_id
       ) reports ON TRUE
      WHERE a.created_at >= now() - interval '90 days'
      ORDER BY a.created_at DESC, a.request_id DESC`,
  );

  return rows.map((row) => ({
    requestId: row.request_id,
    riderPseudonym: row.rider_pseudonym,
    modelVersion: row.model_version,
    promptVersion: row.prompt_version,
    outcome: row.outcome,
    validationOutcome: row.output_validation_outcome,
    fallbackUsed: row.fallback_used,
    toolCallCount: Number(row.tool_call_count),
    latencyMs: Number(row.latency_ms),
    inputTokens: row.input_tokens === null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens === null ? null : Number(row.output_tokens),
    createdAt: row.created_at.toISOString(),
    reports: (row.reports ?? []).map((report) => ({
      id: report.id,
      rideId: report.ride_id,
      reason: report.reason,
      createdAt: report.created_at,
    })),
  }));
}
