import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromConfigWrite, invalidRequest, isConfigId, notFound } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { updateLocation } from '@/lib/admin-config';
import { parseLocationUpdate } from '@/lib/admin-config-rules';
import { readJson } from '@/lib/auth';

/**
 * PATCH /api/admin/locations/[id] (OA-FR-05 to 07, CS455-50): renames a place, changes its
 * detail line, or deactivates or reactivates it; its type and ID never change. Body
 * { name?, detail?, isActive?, version }. 200 { location }; 409 `version_conflict` with
 * `current`.
 */
export async function PATCH(req: Request, ctx: RouteContext<'/api/admin/locations/[id]'>) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id } = await ctx.params;
  if (!isConfigId(id)) return notFound('Place');
  const parsed = parseLocationUpdate(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    { action: 'location.update', entityType: 'location', entityId: id },
    async (client) =>
      fromConfigWrite(await updateLocation(client, id, parsed.value), (record) => record.id),
  );
  return adminActionResponse(result, (location) => ({ location }));
}
