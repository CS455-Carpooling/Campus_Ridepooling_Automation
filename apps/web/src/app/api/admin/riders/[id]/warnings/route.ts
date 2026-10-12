import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromEnforcementWrite, invalidRequest, notFound } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { readJson } from '@/lib/auth';
import { warnRider } from '@/lib/enforcement';
import { parseWarningRequest } from '@/lib/enforcement-rules';
import { isUuid } from '@/lib/ids';

/**
 * POST /api/admin/riders/[id]/warnings (OA-FR-21, CS455-52): warns a rider. Body
 * { reason, complaintId? }; the reason is required and kept. 201 { warning }.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/admin/riders/[id]/warnings'>) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound('Rider');
  const parsed = parseWarningRequest(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    { action: 'rider.warn', entityType: 'user', entityId: id, reason: parsed.value.reason },
    async (client) =>
      fromEnforcementWrite(await warnRider(client, id, parsed.value, access.admin.userId)),
  );
  return adminActionResponse(result, (warning) => ({ warning }), 201);
}
