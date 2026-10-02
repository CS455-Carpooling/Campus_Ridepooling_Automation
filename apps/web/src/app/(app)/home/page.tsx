import type { Metadata } from 'next';
import { AdminHome } from '@/components/home/AdminHome';
import { StudentHome } from '@/components/home/StudentHome';
import { getAdminHome, getStudentHome } from '@/lib/home-data';
import { verifySession } from '@/lib/session';

export const metadata: Metadata = { title: 'Home' };

/** Role-aware home page: students and operations admins see different screens. */
export default async function HomePage() {
  const session = await verifySession();

  if (session.role === 'admin') {
    return <AdminHome data={await getAdminHome()} />;
  }
  return <StudentHome data={await getStudentHome(session.userId)} />;
}
