'use client';

import { useRouter } from 'next/navigation';
import { AuthPage, Landing, type Page } from './PageShells';

type NextPageProps = {
  page: Page;
  notice?: string;
  token?: string;
  initialEmail?: string;
};

export default function NextPage({ page, notice, token, initialEmail }: NextPageProps) {
  const router = useRouter();

  const go = (next: Page) => {
    const routes: Record<Page, string> = {
      home: '/',
      login: '/login',
      register: '/register',
      forgot: '/forgot-password',
      reset: '/reset-password',
    };

    router.push(routes[next]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageProps = { go, initialEmail };

  return page === 'home' ? (
    <Landing go={go} />
  ) : (
    <AuthPage page={page} notice={notice} token={token} {...pageProps} />
  );
}
