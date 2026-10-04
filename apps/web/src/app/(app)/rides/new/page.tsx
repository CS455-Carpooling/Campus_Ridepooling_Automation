import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CreateRideForm } from '@/components/rides/CreateRideForm';
import { getCurrentUser } from '@/lib/auth';
import { getRideFormOptions } from '@/lib/ride-options';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Offer a ride' };

export default async function NewRidePage() {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const options = await getRideFormOptions();
  return <CreateRideForm options={options} />;
}
