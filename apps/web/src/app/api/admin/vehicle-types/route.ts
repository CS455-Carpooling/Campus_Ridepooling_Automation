import { adminActionResponse, withAdminAction } from '@/lib/admin-actions';
import { fromConfigWrite, invalidRequest } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { createVehicleType } from '@/lib/admin-config';
import { idFromName, parseVehicleTypeCreate } from '@/lib/admin-config-rules';
import { readJson } from '@/lib/auth';

/**
 * POST /api/admin/vehicle-types (OA-FR-01, CS455-50): adds a vehicle type. Body
 * { name, capacity }; its ID comes from the name and never changes. 201 { vehicleType }.
 */
export async function POST(req: Request) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const parsed = parseVehicleTypeCreate(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    {
      action: 'vehicle_type.create',
      entityType: 'vehicle_type',
      entityId: idFromName(parsed.value.name) || 'new',
    },
    async (client) =>
      fromConfigWrite(await createVehicleType(client, parsed.value), (record) => record.id),
  );
  return adminActionResponse(result, (vehicleType) => ({ vehicleType }), 201);
}
