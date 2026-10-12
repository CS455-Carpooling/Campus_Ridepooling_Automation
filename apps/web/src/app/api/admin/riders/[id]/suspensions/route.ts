import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromEnforcementWrite, invalidRequest, notFound } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { readJson } from '@/lib/auth';
import { suspendRider } from '@/lib/enforcement';
import { parseSuspensionRequest } from '@/lib/enforcement-rules';
import { isUuid } from '@/lib/ids';

/**
 * POST /api/admin/riders/[id]/suspensions (OA-FR-23, UC-OA-08, SYS-FR-24, 25, CS455-52):
 * suspends a rider for a number of days or indefinitely. Body
 * { reasonCategory, reason, days } or { reasonCategory, reason, indefinite: true }, with an
 * optional complaintId. 201 { suspension }; 409 `already_suspended`.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/admin/riders/[id]/suspensions'>) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound('Rider');
  const parsed = parseSuspensionRequest(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    { action: 'rider.suspend', entityType: 'user', entityId: id, reason: parsed.value.reason },
    async (client) =>
      fromEnforcementWrite(
        await suspendRider(client, id, parsed.value, access.admin.userId, new Date()),
      ),
  );
  return adminActionResponse(result, (suspension) => ({ suspension }), 201);
}
