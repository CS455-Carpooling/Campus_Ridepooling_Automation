import type { Metadata } from 'next';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { VehicleTypesEditor } from '@/components/admin/config/VehicleTypesEditor';
import { requireAdminPage } from '@/lib/admin-auth';
import { getConfiguration } from '@/lib/admin-config-queries';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Vehicle types' };

/** /admin/configuration/vehicle-types (OA-FR-01 to 03, CS455-51). */
export default async function VehicleTypesPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const { vehicleTypes } = await getConfiguration();
  return (
    <AdminPageShell
      title="Vehicle types"
      eyebrow="Configuration"
      back={{ href: routes.adminConfiguration, label: 'Back to configuration' }}
      description="A new capacity applies to rides offered from now on; every ride keeps the capacity it was offered with."
    >
      <VehicleTypesEditor initial={vehicleTypes} />
    </AdminPageShell>
  );
}
