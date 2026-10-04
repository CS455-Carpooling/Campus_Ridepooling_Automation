'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthPage, Landing, type Page } from './PageShells';

type NextPageProps = {
  page: Page;
  notice?: string;
  token?: string;
};

const THEME_KEY = 'campus-ride-pooling-theme';

export default function NextPage({ page, notice, token }: NextPageProps) {
  const router = useRouter();
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = saved ? saved === 'dark' : prefersDark;
    const id = requestAnimationFrame(() => setDarkState(next));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const setDark = (value: boolean) => {
    setDarkState(value);
    localStorage.setItem(THEME_KEY, value ? 'dark' : 'light');
  };

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

  const pageProps = { dark, setDark, go };

  return page === 'home' ? (
    <Landing {...pageProps} />
  ) : (
    <AuthPage page={page} notice={notice} token={token} {...pageProps} />
  );
}
