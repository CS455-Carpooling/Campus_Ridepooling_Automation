'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from './Button';

/**
 * Reads the page's data again from the server without a full reload. Until
 * live updates exist, it is how people see seat changes on a ride.
 */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      className={className}
      disabled={refreshing}
      onClick={() => startTransition(() => router.refresh())}
    >
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
}
