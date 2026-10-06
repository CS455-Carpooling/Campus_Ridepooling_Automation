import NextPage from '../../components/NextPage';
import { getCurrentUser } from '@/lib/auth';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await getCurrentUser();
  const { notice } = await searchParams;
  return <NextPage page="forgot" notice={notice} initialEmail={user?.email} />;
}
