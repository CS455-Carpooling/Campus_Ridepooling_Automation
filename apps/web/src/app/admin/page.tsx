import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminNotAllowed } from '@/components/admin/AdminNotAllowed';
import { requireAdminPage } from '@/lib/admin-auth';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Operations admin' };

/**
 * /admin: an admin's home is the dashboard, so admins go there; a student sees that the
 * admin pages are not for them (US-OA-19), and someone signed out goes to sign in.
 */
export default async function AdminIndexPage() {
  const admin = await requireAdminPage();
  if (!admin) return <AdminNotAllowed />;
  redirect(routes.home);
}
