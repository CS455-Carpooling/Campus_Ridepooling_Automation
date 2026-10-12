import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SearchRideForm } from '@/components/rides/SearchRideForm';
import { getCurrentUser } from '@/lib/auth';
import { getRideFormOptions } from '@/lib/ride-options';
import { getSearchDefaults } from '@/lib/ride-search';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Find a ride' };

/**
 * The /rides page: search for open rides to join. The form options (hubs,
 * campus places, vehicle types) are loaded once on the server so the client
 * component never needs to fetch them separately, together with the rider's
 * saved preferences, which pre-fill the optional filters (FR-RD-02.5).
 */
export default async function RidesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const [options, defaults] = await Promise.all([getRideFormOptions(), getSearchDefaults(user.id)]);
  return <SearchRideForm options={options} defaults={defaults} />;
}
