import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromConfigWrite, invalidRequest } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { setExternalFareRange } from '@/lib/admin-config';
import { parseExternalFareRange } from '@/lib/admin-config-rules';
import { readJson } from '@/lib/auth';

/**
 * PUT /api/admin/external-fares (OA-FR-11, SYS-FR-12, CS455-50): sets the typical fare range
 * from a hub for a vehicle type, shown to riders as an estimate only. Body
 * { hubId, vehicleTypeId, minFare, maxFare, version }, with `version` null for a range not
 * set yet. 200 { range }; 409 `version_conflict` with `current`.
 */
export async function PUT(req: Request) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const parsed = parseExternalFareRange(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);
  const { hubId, vehicleTypeId } = parsed.value;

  const result = await withAdminAction(
    access.admin,
    {
      action: 'external_fare.set',
      entityType: 'external_fare',
      entityId: `${hubId}:${vehicleTypeId}`,
    },
    async (client) =>
      fromConfigWrite(
        await setExternalFareRange(client, parsed.value, access.admin.userId),
        (range) => `${range.hubId}:${range.vehicleTypeId}`,
      ),
  );
  return adminActionResponse(result, (range) => ({ range }));
}
