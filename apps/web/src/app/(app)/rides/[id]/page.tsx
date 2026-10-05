import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RideDetails } from '@/components/rides/RideDetails';
import { getCurrentUser } from '@/lib/auth';
import { getRideView } from '@/lib/ride-view';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Ride details' };

/**
 * One ride's details (CS455-29). Signed-in students only; getRideView applies
 * who may see the ride, and answers null for a ride that does not exist or
 * that the viewer may not see, which both show "Ride not found".
 */
export default async function RidePage({ params }: PageProps<'/rides/[id]'>) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const { id } = await params;
  const ride = await getRideView(id, user.id);
  if (!ride) notFound();

  return <RideDetails ride={ride} />;
}
