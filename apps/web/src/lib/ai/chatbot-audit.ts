import 'server-only';
import { pool } from '../db';
import { isUuid } from '../ids';

export type ChatbotToolAudit = {
  tool: string;
  success: boolean;
};

export type LogChatbotAuditParams = {
  requestId: string;
  userId: string;
  modelVersion?: string;
  promptVersion?: string;
  toolCalls?: ChatbotToolAudit[];
  outcome: string;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

/**
 * Records an immutable audit log for an AI chatbot interaction (AI-RD-12).
 * Stores request metadata, tool executions, model/prompt version, latency, and outcome
 * WITHOUT storing private message text (FR-RD-05.6, AI-RD-12).
 */
export async function logChatbotAudit({
  requestId,
  userId,
  modelVersion = 'campus-ai-v1',
  promptVersion = '1.0',
  toolCalls = [],
  outcome,
  latencyMs,
  inputTokens = null,
  outputTokens = null,
}: LogChatbotAuditParams): Promise<void> {
  if (!isUuid(requestId) || !isUuid(userId)) {
    return;
  }

  try {
    await pool.query(
      `INSERT INTO chatbot_audits
         (request_id, user_id, model_version, prompt_version, tool_calls, outcome, latency_ms, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        requestId,
        userId,
        modelVersion,
        promptVersion,
        JSON.stringify(toolCalls),
        outcome,
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
