'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { useTripRequest } from './trip-hooks';

export type TripActionButtonProps = {
  /** The button that opens the question. */
  label: string;
  /** A fuller name for that button when several sit together, such as "Kabir Shah is a no-show". */
  ariaLabel?: string;
  /** The question, as a heading. */
  question: string;
  /** What will happen, under the question. */
  detail: ReactNode;
  /** The button that does it, such as "Yes, start pickup". */
  confirm: string;
  /** The same button while the request is under way. */
  busy: string;
  /** Shown beside the button before it is pressed. */
  hint?: ReactNode;
  /** The API to POST to, and its JSON body if it takes one. */
  url: string;
  body?: object;
  variant?: ButtonVariant;
  /** Said when the request fails without a reason from the server. */
  failure: string;
};

/**
 * A trip step that asks first, in place (CS455-63): starting pickup, starting the trip,
 * completing the ride or recording a no-show. Focus moves to the question and back. The result
 * shows only once the server confirms it: the page is read again, so it then shows the new state.
 */
export function TripActionButton({
  label,
  ariaLabel,
  question,
  detail,
  confirm,
  busy: busyLabel,
  hint,
  url,
  body,
  variant = 'secondary',
  failure,
}: TripActionButtonProps) {
  const { send, busy, error, clearError } = useTripRequest(failure);
  const [confirming, setConfirming] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);
  const headingId = useId();

  // Focus follows the switch between the button and the question, but not on the first render.
  useEffect(() => {
    if (!moveFocus.current) return;
    (confirming ? questionRef.current : openButton.current)?.focus();
  }, [confirming]);

  function show(next: boolean) {
    moveFocus.current = true;
    clearError();
    setConfirming(next);
  }

  if (!confirming) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          ref={openButton}
          variant={variant}
          aria-label={ariaLabel}
          onClick={() => show(true)}
        >
          {label}
        </Button>
        {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      </div>
    );
  }

  return (
    <section
      ref={questionRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="w-full rounded-panel border border-line-strong p-5 sm:p-6"
    >
      <h3 id={headingId} className="text-lg font-bold tracking-tight">
        {question}
      </h3>
      <div className="mt-2 text-ink-muted">{detail}</div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => send(url, body)} disabled={busy}>
          {busy ? busyLabel : confirm}
        </Button>
        <Button variant="secondary" onClick={() => show(false)} disabled={busy}>
          Not yet
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
