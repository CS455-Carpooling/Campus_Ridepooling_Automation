import { redirect } from 'next/navigation';

/** Legacy /home route kept as an alias to the dashboard. */
export default function HomePage() {
  redirect('/dashboard');
}
