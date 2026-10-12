import type { Metadata } from 'next';
import { verifySession } from '@/lib/session';
import { NotificationsCentre } from '@/components/notifications/NotificationsCentre';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  await verifySession();
  return <NotificationsCentre />;
}
