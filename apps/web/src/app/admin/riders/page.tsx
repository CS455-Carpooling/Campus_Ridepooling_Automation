import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { RiderSearchForm } from '@/components/admin/complaints/RiderSearchForm';
import { requireAdminPage } from '@/lib/admin-auth';
import { searchRiders } from '@/lib/admin-rider-queries';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Riders' };

/** /admin/riders (CS455-53, OA-FR-42): find a rider by name, email or roll number. */
export default async function AdminRidersPage({ searchParams }: PageProps<'/admin/riders'>) {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;

  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim() : '';
  const riders = await searchRiders(query);

  return (
    <AdminPageShell
      title="Riders"
      description="Find a rider to see their record: rides, complaints, warnings and suspensions."
    >
      <RiderSearchForm query={query} />
      {query.length >= 2 &&
        (riders.length === 0 ? (
          <p className="mt-8 text-ink-muted">No rider matches &ldquo;{query}&rdquo;.</p>
        ) : (
          <ul aria-label="Riders found" className="mt-8 divide-y divide-line border-y border-line">
            {riders.map((rider) => (
              <li
                key={rider.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
              >
                <div className="min-w-0">
                  <Link href={routes.adminRider(rider.id)} className="font-semibold">
                    {rider.name}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    {rider.email}, roll number {rider.rollNumber}
                  </p>
                </div>
                <p className="flex flex-wrap gap-2 text-sm">
                  {rider.isAdmin && <span className="font-semibold">Operations admin</span>}
                  {rider.suspended && <span className="font-semibold text-danger">Suspended</span>}
                </p>
              </li>
            ))}
          </ul>
        ))}
    </AdminPageShell>
  );
}
