import type { Metadata } from 'next';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { FareRangesEditor } from '@/components/admin/config/FareRangesEditor';
import { requireAdminPage } from '@/lib/admin-auth';
import { getConfiguration } from '@/lib/admin-config-queries';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Fares' };

/** /admin/configuration/fares (OA-FR-11, SYS-FR-12, CS455-51). */
export default async function FaresPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const data = await getConfiguration();
  return (
    <AdminPageShell
      title="Fares"
      eyebrow="Configuration"
      back={{ href: routes.adminConfiguration, label: 'Back to configuration' }}
      description="Fares here are guidance. No admin setting changes the fare of a ride already offered."
    >
      <FareRangesEditor
        hubs={data.hubs}
        vehicleTypes={data.vehicleTypes}
        ranges={data.externalFareRanges}
      />
    </AdminPageShell>
  );
}
