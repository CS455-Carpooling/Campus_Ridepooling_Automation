import type { Metadata } from 'next';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { PlacesEditor } from '@/components/admin/config/PlacesEditor';
import { requireAdminPage } from '@/lib/admin-auth';
import { getConfiguration } from '@/lib/admin-config-queries';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Hubs and pickup points' };

/** /admin/configuration/hubs (OA-FR-05 to 07, CS455-51): transport hubs and campus places. */
export default async function HubsPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const { hubs, campusPlaces } = await getConfiguration();
  return (
    <AdminPageShell
      title="Hubs and pickup points"
      eyebrow="Configuration"
      back={{ href: routes.adminConfiguration, label: 'Back to configuration' }}
      description="A place keeps its ID for good, so renaming it never changes the rides that use it."
    >
      <div className="flex flex-col gap-12">
        <PlacesEditor type="transport_hub" initial={hubs} />
        <PlacesEditor type="campus" initial={campusPlaces} />
      </div>
    </AdminPageShell>
  );
}
