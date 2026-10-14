import { redirect } from 'next/navigation';
import NextPage from '../../components/NextPage';
import { getCurrentUser } from '@/lib/auth';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  if (
    await getCurrentUser({
      allowIncompleteProfile: true,
      allowUnacknowledgedWarnings: true,
    })
  )
    redirect('/dashboard');
  const { notice } = await searchParams;
  return <NextPage page="register" notice={notice} />;
}
