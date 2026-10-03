import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/** Kept so old links keep working: the signed-in start page is /home. */
export default function DashboardPage() {
  redirect(routes.home);
}
