import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromConfigWrite, invalidRequest, isConfigId, notFound } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { updateVehicleType } from '@/lib/admin-config';
import { parseVehicleTypeUpdate } from '@/lib/admin-config-rules';
import { readJson } from '@/lib/auth';

/**
 * PATCH /api/admin/vehicle-types/[id] (OA-FR-02, 03, CS455-50): renames a vehicle type,
 * changes its capacity for new rides, or deactivates or reactivates it. Body
 * { name?, capacity?, isActive?, version }. 200 { vehicleType }; 409 `version_conflict` with
 * `current` when another admin changed it first.
 */
export async function PATCH(req: Request, ctx: RouteContext<'/api/admin/vehicle-types/[id]'>) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id } = await ctx.params;
  if (!isConfigId(id)) return notFound('Vehicle type');
  const parsed = parseVehicleTypeUpdate(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    { action: 'vehicle_type.update', entityType: 'vehicle_type', entityId: id },
    async (client) =>
      fromConfigWrite(await updateVehicleType(client, id, parsed.value), (record) => record.id),
  );
  return adminActionResponse(result, (vehicleType) => ({ vehicleType }));
}
