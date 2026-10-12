import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromConfigWrite, invalidRequest } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { setCampusFare } from '@/lib/admin-config';
import { parseCampusFare } from '@/lib/admin-config-rules';
import { readJson } from '@/lib/auth';

/**
 * PUT /api/admin/campus-fares (OA-FR-10, CS455-50): sets the fixed fare between two campus
 * places for a vehicle type. Body { fromId, toId, vehicleTypeId, fare, version }, with
 * `version` null for a fare not set yet. 200 { fare }; 409 `version_conflict` with `current`.
 */
export async function PUT(req: Request) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const parsed = parseCampusFare(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);
  const { fromId, toId, vehicleTypeId } = parsed.value;

  const result = await withAdminAction(
    access.admin,
    {
      action: 'campus_fare.set',
      entityType: 'campus_fare',
      entityId: `${fromId}:${toId}:${vehicleTypeId}`,
    },
    async (client) =>
      fromConfigWrite(
        await setCampusFare(client, parsed.value, access.admin.userId),
        (fare) => `${fare.fromId}:${fare.toId}:${fare.vehicleTypeId}`,
      ),
  );
  return adminActionResponse(result, (fare) => ({ fare }));
}
