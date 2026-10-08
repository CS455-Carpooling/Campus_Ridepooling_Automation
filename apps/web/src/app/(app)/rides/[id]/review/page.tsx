import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RideReview } from '@/components/rides/RideReview';
import { getCurrentUser } from '@/lib/auth';
import { getRatingPage } from '@/lib/ride-ratings';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Rate this ride' };

/**
 * The review page (CS455-43): rate the people on a completed ride. Only people
 * with a seat on the ride may open it; for anyone else, and for a ride that
 * does not exist, getRatingPage answers null and the page shows "Ride not found".
 */
export default async function RideReviewPage({ params }: PageProps<'/rides/[id]/review'>) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const { id } = await params;
  const page = await getRatingPage(id, user.id);
  if (!page) notFound();

  return <RideReview page={page} />;
}
