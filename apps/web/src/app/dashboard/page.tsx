import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <main className="shell" style={{ padding: '80px 0' }}>
      <h1 style={{ fontFamily: 'Manrope', fontSize: 36, letterSpacing: -1.5 }}>
        Hi, {user.full_name.split(' ')[0]}
      </h1>
      <p style={{ color: 'var(--muted)', margin: '12px 0 28px' }}>
        Signed in as {user.email}. Build your rides dashboard here.
      </p>
      <form action="/api/auth/logout" method="post">
        <button className="button">Log out</button>
      </form>
    </main>
  );
}
