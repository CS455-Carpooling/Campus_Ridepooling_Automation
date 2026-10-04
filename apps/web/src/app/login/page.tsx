import { redirect } from 'next/navigation';
import NextPage from '../../components/NextPage';
import { getCurrentUser } from '@/lib/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  if (await getCurrentUser()) redirect('/dashboard');
  const { notice } = await searchParams;
  return <NextPage page="login" notice={notice} />;
}
