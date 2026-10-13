'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ChoiceCards } from '@/components/ui/ChoiceCards';
import { TextAreaField } from '@/components/ui/TextAreaField';
import type { ComplaintFormPage } from '@/lib/complaint-queries';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_RULES,
  complaintCategoryLabels,
  parseComplaintRequest,
  type ComplaintField,
} from '@/lib/complaint-rules';
import { formatDeparture } from '@/lib/format';
import { routes } from '@/lib/routes';
import { EmergencyContacts } from './EmergencyContacts';

const categoryHints: Record<string, string> = {
  safety: 'Unsafe driving, threats, or anything that put someone at risk',
  harassment: 'Unwanted comments, contact or behaviour',
  tardiness: 'Arriving very late, or keeping everyone waiting',
  payment: 'Not paying a share, or asking for more than agreed',
  no_show: 'Did not turn up for the ride',
  other: 'Anything else that went wrong',
};

/**
 * The complaint form (CS455-53, FR-RD-13.1 to 13.6, FR-RD-09.6): about someone on the ride,
 * chosen by their seat, with a category and what happened. Opened from a reported chat message,
 * it is about that message's sender, and the message goes with the complaint. Safety shows the
 * emergency numbers at once. On success it shows the complaint's reference.
 */
export function ComplaintForm({ page }: { page: ComplaintFormPage }) {
  const router = useRouter();
  const sender = page.message
    ? page.people.find((person) => person.occupantId === page.message?.senderOccupantId)
    : undefined;
  const open = page.people.filter((person) => !person.filedReference);
  const [occupantId, setOccupantId] = useState(
    sender?.filedReference ? '' : (sender?.occupantId ?? ''),
  );
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Partial<Record<ComplaintField, string>>>({});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const done = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reference) done.current?.focus();
  }, [reference]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const parsed = parseComplaintRequest({
      occupantId,
      category,
      description,
      messageId: page.message?.id ?? null,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setMessage('Check the highlighted fields.');
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(page.rideId)}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.value),
      });
      const data = (await response.json().catch(() => ({}))) as {
        reference?: string;
        error?: string;
        fields?: Partial<Record<ComplaintField, string>>;
      };
      if (response.status === 201 && data.reference) {
        setReference(data.reference);
        return;
      }
      if (response.status === 401) {
        router.push(routes.login);
        return;
      }
      setErrors(data.fields ?? {});
      setMessage(data.error ?? 'Your complaint could not be sent. Try again.');
    } catch {
      setMessage('Unable to reach the server. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (reference) {
    return (
      <section
        ref={done}
        tabIndex={-1}
        aria-label="Complaint sent"
        data-surface="brand"
        className="mt-8 rounded-panel bg-brand p-5 text-on-brand sm:p-6"
      >
        <p className="text-sm font-semibold text-on-brand-muted">
          Your complaint was sent. Its reference is
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
          {reference}
        </p>
        <p className="mt-2 text-sm text-on-brand-muted">
          An operations admin will review it. You can follow its status under Your complaints. The
          person it is about is not told who complained or what you wrote.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={routes.myComplaints} variant="accent">
            Your complaints
          </ButtonLink>
          <Link
            href={routes.ride(page.rideId)}
            className="inline-flex min-h-11 items-center font-semibold text-on-brand underline underline-offset-4"
          >
            Back to the ride
          </Link>
        </div>
      </section>
    );
  }

  const filed = page.people.filter((person) => person.filedReference);
  const choices = (sender && !sender.filedReference ? [sender] : open).map((person) => ({
    value: person.occupantId,
    label: person.name,
    description: `${person.isOwner ? 'Ride owner' : 'Rider'}, ${person.campusPlace}`,
  }));

  return (
    <form noValidate onSubmit={submit} className="mt-8 flex flex-col gap-8">
      {page.message && (
        <section
          aria-label="The message you are reporting"
          className="rounded-panel border border-line-strong p-5"
        >
          <p className="text-sm font-semibold">
            The message you are reporting, sent {formatDeparture(page.message.sentAt)}
          </p>
          <p className="mt-2 text-lg">{page.message.body}</p>
        </section>
      )}

      {filed.length > 0 && (
        <ul
          aria-label="Complaints you already filed on this ride"
          className="space-y-1 text-sm text-ink-muted"
        >
          {filed.map((person) => (
            <li key={person.occupantId}>
              You already filed <span className="font-mono">{person.filedReference}</span> about{' '}
              {person.name}.
            </li>
          ))}
        </ul>
      )}

      {choices.length === 0 ? (
        <p className="text-ink-muted">
          You have filed a complaint about everyone else on this ride. Follow them under Your
          complaints.
        </p>
      ) : (
        <>
          <ChoiceCards
            legend="Who is the complaint about?"
            name="occupantId"
            choices={choices}
            value={occupantId}
            onChange={setOccupantId}
            error={errors.occupantId}
          />
          <ChoiceCards
            legend="What happened?"
            name="category"
            choices={COMPLAINT_CATEGORIES.map((value) => ({
              value,
              label: complaintCategoryLabels[value],
              description: categoryHints[value],
            }))}
            value={category}
            onChange={setCategory}
            error={errors.category}
          />
          {category === 'safety' && <EmergencyContacts />}
          {category === 'safety' && page.sosAvailable && (
            <p className="font-semibold">
              Your trip is under way: if you are in danger now, use{' '}
              <Link href={routes.ride(page.rideId)}>SOS on the ride page</Link>.
            </p>
          )}
          <div className="flex flex-col gap-1">
            <TextAreaField
              label="Describe what happened"
              hint={`At least ${COMPLAINT_RULES.minDescription} characters. Say when and where it happened. Your words are kept exactly as you write them.`}
              value={description}
              maxLength={COMPLAINT_RULES.maxDescription}
              rows={6}
              onChange={(event) => setDescription(event.target.value)}
              aria-invalid={errors.description ? true : undefined}
            />
            {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
          </div>
          <p className="text-sm text-ink-muted">
            The person you complain about is not told who complained or what you wrote. You can file
            one complaint about each person on a ride, and at most {COMPLAINT_RULES.maxPerDay} in a
            day.
          </p>
          {message && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
            <Button type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send complaint'}
            </Button>
            <ButtonLink href={routes.ride(page.rideId)} variant="quiet">
              Cancel
            </ButtonLink>
          </div>
        </>
      )}
    </form>
  );
}
