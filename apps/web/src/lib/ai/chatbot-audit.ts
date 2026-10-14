import 'server-only';
import { createHash } from 'node:crypto';
import { pool } from '../db';
import { isUuid } from '../ids';

export type ChatbotToolAudit = {
  tool: string;
  arguments?: Record<string, unknown>;
  resultSize?: number;
  success: boolean;
};

export type LogChatbotAuditParams = {
  requestId: string;
  userId: string;
  modelVersion?: string;
  promptVersion?: string;
  toolCalls?: ChatbotToolAudit[];
  outcome: string;
  validationOutcome?: string;
  fallbackUsed?: boolean;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export type ChatbotAuditRecord = {
  requestId: string;
  pseudonymousRiderId: string;
  userId: string;
  modelVersion: string;
  promptVersion: string;
  toolCalls: ChatbotToolAudit[];
  outcome: string;
  validationOutcome: string;
  fallbackUsed: boolean;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
};

/**
 * Creates a consistent pseudonymous identifier for a rider (AI-RD-12).
 */
export function createPseudonymousRiderId(userId: string): string {
  return 'rider-' + createHash('sha256').update(userId).digest('hex').slice(0, 10);
}

/**
 * Purges chatbot audit records older than 90 days (AI-RD-12, P-28).
 */
export async function purgeExpiredChatbotAudits(): Promise<number> {
  try {
    const res = await pool.query(
      "DELETE FROM chatbot_audits WHERE created_at < now() - interval '90 days'",
    );
    return res.rowCount ?? 0;
  } catch (error) {
    console.error('Failed to purge expired chatbot audits:', error);
    return 0;
  }
}

/**
 * Records an immutable audit log for an AI chatbot interaction (AI-RD-12).
 * Stores request metadata, tool executions with arguments/result sizes, model/prompt version,
 * validation outcome, fallback status, latency, and tokens WITHOUT storing private message text (FR-RD-05.6, AI-RD-12).
 */
export async function logChatbotAudit({
  requestId,
  userId,
  modelVersion = 'campus-ai-v1',
  promptVersion = '1.0',
  toolCalls = [],
  outcome,
  validationOutcome = 'valid',
  fallbackUsed = false,
  latencyMs,
  inputTokens = null,
  outputTokens = null,
}: LogChatbotAuditParams): Promise<void> {
  if (!isUuid(requestId) || !isUuid(userId)) {
    return;
  }

  try {
    // Enforce 90-day retention cleanup on audit logging (AI-RD-12, P-28)
    await purgeExpiredChatbotAudits();

    await pool.query(
      `INSERT INTO chatbot_audits
         (request_id, user_id, model_version, prompt_version, tool_calls, outcome, validation_outcome, fallback_used, latency_ms, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        requestId,
        userId,
        modelVersion,
        promptVersion,
        JSON.stringify(toolCalls),
        outcome,
        validationOutcome,
        fallbackUsed,
        Math.max(0, Math.round(latencyMs)),
        inputTokens,
        outputTokens,
      ],
    );
  } catch (error) {
    // Non-blocking: Audit failure should not crash user-facing response
    console.error('Failed to log chatbot audit:', error);
  }
}

/**
 * Retrieves recent chatbot audit records for administrator inspection (AI-RD-12).
 * Formats user IDs into pseudonymous rider IDs and parses tool executions.
 */
export async function listChatbotAudits(limit = 50): Promise<ChatbotAuditRecord[]> {
  try {
    const res = await pool.query(
      `SELECT
         request_id,
         user_id,
         model_version,
         prompt_version,
         tool_calls,
         outcome,
         COALESCE(validation_outcome, outcome) AS validation_outcome,
         COALESCE(fallback_used, false) AS fallback_used,
         latency_ms,
         input_tokens,
         output_tokens,
         created_at
       FROM chatbot_audits
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    return res.rows.map((row) => ({
      requestId: row.request_id,
      pseudonymousRiderId: createPseudonymousRiderId(row.user_id),
      userId: row.user_id,
      modelVersion: row.model_version,
      promptVersion: row.prompt_version,
      toolCalls: Array.isArray(row.tool_calls)
        ? row.tool_calls
        : typeof row.tool_calls === 'string'
          ? JSON.parse(row.tool_calls)
          : [],
      outcome: row.outcome,
      validationOutcome: row.validation_outcome,
      fallbackUsed: Boolean(row.fallback_used),
      latencyMs: row.latency_ms,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to list chatbot audits:', error);
    return [];
  }
}
