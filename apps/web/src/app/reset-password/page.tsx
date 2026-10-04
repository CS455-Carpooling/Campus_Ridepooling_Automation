import { redirect } from 'next/navigation';
import NextPage from '../../components/NextPage';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect('/forgot-password');
  return <NextPage page="reset" token={token} />;
}
