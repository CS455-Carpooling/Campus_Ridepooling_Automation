import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromConfigWrite, invalidRequest } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { createLocation } from '@/lib/admin-config';
import { idFromName, parseLocationCreate } from '@/lib/admin-config-rules';
import { readJson } from '@/lib/auth';

/**
 * POST /api/admin/locations (OA-FR-05, 07, CS455-50): adds a campus place or a transport hub.
 * Body { type, name, detail? }; its ID comes from the name and never changes.
 * 201 { location }.
 */
export async function POST(req: Request) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const parsed = parseLocationCreate(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    {
      action: 'location.create',
      entityType: 'location',
      entityId: idFromName(parsed.value.name) || 'new',
    },
    async (client) =>
      fromConfigWrite(await createLocation(client, parsed.value), (record) => record.id),
  );
  return adminActionResponse(result, (location) => ({ location }), 201);
}
