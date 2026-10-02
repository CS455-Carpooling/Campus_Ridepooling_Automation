'use client'; // Error boundaries must be Client Components.

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Something went wrong</h1>
      <p className="mt-5 max-w-xl text-lg text-ink-muted">
        This page could not be shown. Try again, and if the problem continues, come back later.
      </p>
      <Button className="mt-8" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
