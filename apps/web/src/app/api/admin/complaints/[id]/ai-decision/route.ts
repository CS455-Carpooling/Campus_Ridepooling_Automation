import { adminActionResponse, adminRefusal, withAdminAction } from '@/lib/admin-actions';
import { fromEnforcementWrite, invalidRequest, notFound } from '@/lib/admin-api';
import { decideComplaintAi } from '@/lib/ai-enforcement';
import { requireAdminApi } from '@/lib/admin-auth';
import { readJson } from '@/lib/auth';
import { parseAiDecisionRequest } from '@/lib/complaint-ai-rules';
import { isUuid } from '@/lib/ids';

/** POST /api/admin/complaints/[id]/ai-decision (OA-FR-34, 36; SYS-FR-35, 37, 38). */
export async function POST(
  req: Request,
  ctx: RouteContext<'/api/admin/complaints/[id]/ai-decision'>,
) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id: complaintId } = await ctx.params;
  if (!isUuid(complaintId)) return notFound('Complaint');
  const body = await readJson(req);
  const parsed = parseAiDecisionRequest(body);
  if (!parsed.ok) return invalidRequest(parsed.errors);
  const analysisId =
    typeof body === 'object' && body !== null && 'analysisId' in body ? body.analysisId : undefined;
  if (!isUuid(analysisId)) {
    return invalidRequest({ analysisId: 'Reload the complaint and choose a valid AI analysis.' });
  }

  const result = await withAdminAction(
    access.admin,
    {
      action: 'ai.decide',
      entityType: 'complaint',
      entityId: complaintId,
      reason: parsed.value.reason,
    },
    async (client) => {
      const decision = await decideComplaintAi(
        client,
        complaintId,
        analysisId,
        parsed.value,
        access.admin.userId,
        new Date(),
      );
      switch (decision.kind) {
        case 'done':
          return {
            ok: true,
            value: decision.record,
            before: decision.before,
            after: decision.record,
          };
        case 'not_found':
          return adminRefusal(404, 'not_found', 'AI analysis not found for this complaint.');
        case 'already_decided':
          return adminRefusal(
            409,
            'already_decided',
            'This AI recommendation already has a decision.',
          );
        case 'invalid_analysis':
          return adminRefusal(
            409,
            'manual_review',
            'This analysis is unavailable; review the complaint manually.',
          );
        case 'recommendation_mismatch':
          return adminRefusal(
            400,
            'recommendation_mismatch',
            'Reload the page and use the current recommendation.',
          );
        case 'enforcement_failed':
          return fromEnforcementWrite(decision.result);
      }
    },
  );
  return adminActionResponse(result, (decision) => ({ decision }), 201);
}
