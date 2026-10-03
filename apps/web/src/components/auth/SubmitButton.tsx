import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/** Full-width submit button of the account forms, disabled while the request runs. */
export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="mt-2 w-full justify-between">
      {children}
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Button>
  );
}
