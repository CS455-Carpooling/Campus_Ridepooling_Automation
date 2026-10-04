import type { Metadata } from 'next';
import { CreateRideForm } from '@/components/rides/CreateRideForm';

export const metadata: Metadata = { title: 'Offer a ride' };

export default function NewRidePage() {
  return <CreateRideForm />;
}
