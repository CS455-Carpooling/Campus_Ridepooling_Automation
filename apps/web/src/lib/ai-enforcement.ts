import 'server-only';
import type { PoolClient } from 'pg';
import {
  complaintCategoryForAiSuspension,
  type AiDecisionRequest,
  type ComplaintAiAction,
} from './complaint-ai-rules';
import { suspendRider, warnRider, type EnforcementWrite } from './enforcement';

type AnalysisRow = {
  id: string;
  outcome: string;
  recommended_action: ComplaintAiAction | null;
  recommended_suspension_days: number | null;
  recommended_indefinite: boolean;
  complaint_id: string;
  accused_id: string;
  category: string;
};

export type AiDecisionRecord = {
  id: string;
  analysisId: string;
  complaintId: string;
  decision: AiDecisionRequest['decision'];
  reason: string | null;
  finalAction: ComplaintAiAction;
  warningId: string | null;
  suspensionId: string | null;
  decidedBy: string;
  decidedAt: string;
};

export type AiDecisionWrite =
  | {
      kind: 'done';
      record: AiDecisionRecord;
      before: {
        analysisId: string;
        recommendedAction: ComplaintAiAction;
        recommendedSuspensionDays: number | null;
        recommendedIndefinite: boolean;
      };
    }
  | { kind: 'not_found' | 'already_decided' | 'invalid_analysis' | 'recommendation_mismatch' }
  | { kind: 'enforcement_failed'; result: EnforcementWrite<unknown> };

/** Apply an explicit human decision and its audit record in the caller's admin transaction. */
export async function decideComplaintAi(
  client: PoolClient,
  complaintId: string,
  analysisId: string,
  request: AiDecisionRequest,
  adminId: string,
  now: Date,
): Promise<AiDecisionWrite> {
  const { rows } = await client.query<AnalysisRow>(
    `SELECT a.id, a.outcome, a.recommended_action, a.recommended_suspension_days,
            a.recommended_indefinite, c.id AS complaint_id, c.accused_id, c.category
     FROM complaint_ai_analyses a
     JOIN complaints c ON c.id = a.complaint_id
     WHERE a.id = $1 AND c.id = $2
     FOR UPDATE OF a`,
    [analysisId, complaintId],
  );
  const analysis = rows[0];
  if (!analysis) return { kind: 'not_found' };
  if (analysis.outcome !== 'ai_validated' || !analysis.recommended_action) {
    return { kind: 'invalid_analysis' };
  }
  const previousDecision = await client.query(
    'SELECT 1 FROM ai_enforcement_decisions WHERE analysis_id = $1',
    [analysisId],
  );
  if (previousDecision.rows.length > 0) return { kind: 'already_decided' };

  const finalAction = request.decision === 'rejected' ? 'none' : request.finalAction;
  if (request.decision === 'approved') {
    const sameLength =
      analysis.recommended_action !== 'suspension' ||
      (analysis.recommended_indefinite
        ? request.indefinite && request.days === null
        : !request.indefinite && request.days === analysis.recommended_suspension_days);
    if (finalAction !== analysis.recommended_action || !sameLength) {
      return { kind: 'recommendation_mismatch' };
    }
  }

  let warningId: string | null = null;
  let suspensionId: string | null = null;
  if (finalAction === 'warning') {
    const write = await warnRider(
      client,
      analysis.accused_id,
      { reason: request.reason ?? '', complaintId },
      adminId,
    );
    if (write.kind !== 'done') return { kind: 'enforcement_failed', result: write };
    warningId = write.record.id;
  } else if (finalAction === 'suspension') {
    const reasonCategory = complaintCategoryForAiSuspension(analysis.category);
    if (!reasonCategory) return { kind: 'invalid_analysis' };
    const write = await suspendRider(
      client,
      analysis.accused_id,
      {
        reasonCategory,
        reason: request.reason ?? '',
        days: request.indefinite ? null : request.days,
        indefinite: request.indefinite,
        complaintId,
      },
      adminId,
      now,
    );
    if (write.kind !== 'done') return { kind: 'enforcement_failed', result: write };
    suspensionId = write.record.id;
  }

  const saved = await client.query<{ id: string; decided_at: Date }>(
    `INSERT INTO ai_enforcement_decisions
       (analysis_id, complaint_id, decision, reason, final_action, warning_id,
        suspension_id, decided_by, decided_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, decided_at`,
    [
      analysisId,
      complaintId,
      request.decision,
      request.reason,
      finalAction,
      warningId,
      suspensionId,
      adminId,
      now,
    ],
  );
  return {
    kind: 'done',
    record: {
      id: saved.rows[0].id,
      analysisId,
      complaintId,
      decision: request.decision,
      reason: request.reason,
      finalAction,
      warningId,
      suspensionId,
      decidedBy: adminId,
      decidedAt: saved.rows[0].decided_at.toISOString(),
    },
    before: {
      analysisId,
      recommendedAction: analysis.recommended_action,
      recommendedSuspensionDays: analysis.recommended_suspension_days,
      recommendedIndefinite: analysis.recommended_indefinite,
    },
  };
}
