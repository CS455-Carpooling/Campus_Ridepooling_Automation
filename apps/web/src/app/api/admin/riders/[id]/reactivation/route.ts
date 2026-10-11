import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromEnforcementWrite, invalidRequest, notFound } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { readJson } from '@/lib/auth';
import { reactivateRider } from '@/lib/enforcement';
import { parseReactivationRequest } from '@/lib/enforcement-rules';
import { isUuid } from '@/lib/ids';

/**
 * POST /api/admin/riders/[id]/reactivation (OA-FR-28, SYS-FR-26, US-OA-14, CS455-52): lifts
 * the rider's suspension before its end. Body { reason }, required and kept with the
 * suspension, whose history stays. 200 { reactivation }; 409 `not_suspended`.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/admin/riders/[id]/reactivation'>) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound('Rider');
  const parsed = parseReactivationRequest(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    { action: 'rider.reactivate', entityType: 'user', entityId: id, reason: parsed.value.reason },
    async (client) =>
      fromEnforcementWrite(
        await reactivateRider(client, id, parsed.value, access.admin.userId, new Date()),
      ),
  );
  return adminActionResponse(result, (reactivation) => ({ reactivation }));
}
