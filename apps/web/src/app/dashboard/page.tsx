import type { Metadata } from 'next';
import { AdminHome } from '@/components/home/AdminHome';
import { StudentHome } from '@/components/home/StudentHome';
import { getAdminHome, getStudentHome } from '@/lib/home-data';
import { verifySession } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };

/** The authenticated home/dashboard screen for students and admins. */
export default async function DashboardPage() {
  const session = await verifySession();

  const content =
    session.role === 'admin' ? (
      <AdminHome data={await getAdminHome()} />
    ) : (
      <StudentHome data={await getStudentHome(session.userId)} />
    );

  return content;
}
