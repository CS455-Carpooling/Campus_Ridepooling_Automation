import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { requireAdminPage } from '@/lib/admin-auth';
import { getConfiguration } from '@/lib/admin-config-queries';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Configuration' };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** /admin/configuration (CS455-51): what can be configured, and how much of it is active. */
export default async function ConfigurationPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const data = await getConfiguration();
  const active = <T extends { isActive: boolean }>(items: T[]) =>
    items.filter((item) => item.isActive).length;
  const activeHubs = active(data.hubs);
  const activeTypes = active(data.vehicleTypes);

  const sections = [
    {
      href: routes.adminVehicleTypes,
      title: 'Vehicle types',
      text: 'The vehicles a ride can use, and how many people each carries.',
      facts: [
        count(activeTypes, 'active type', 'active types'),
        count(data.vehicleTypes.length - activeTypes, 'inactive', 'inactive'),
      ],
    },
    {
      href: routes.adminHubs,
      title: 'Hubs and pickup points',
      text: 'The transport hubs rides go to or from, and the campus places people are picked up at.',
      facts: [
        count(activeHubs, 'active hub', 'active hubs'),
        count(active(data.campusPlaces), 'campus place', 'campus places'),
      ],
    },
    {
      href: routes.adminFares,
      title: 'Fares',
      text: 'Typical fare ranges from each hub, shown to riders as estimates. Ride fares are split equally among occupants.',
      facts: [`${data.externalFareRanges.length} of ${activeHubs * activeTypes} hub ranges set`],
    },
  ];

  return (
    <AdminPageShell
      title="Configuration"
      description="Changes apply to new rides. Rides already offered keep their vehicle, capacity and places."
    >
      <ul className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <li
            key={section.href}
            className="flex flex-col rounded-panel border border-line p-5 sm:p-6"
          >
            <h2 className="text-xl font-bold tracking-tight">
              <Link href={section.href}>{section.title}</Link>
            </h2>
            <p className="mt-2 text-ink-muted">{section.text}</p>
            <ul className="mt-4 space-y-1 font-mono text-sm tabular-nums">
              {section.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </AdminPageShell>
  );
}
