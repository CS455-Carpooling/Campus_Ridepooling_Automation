'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/Field';
import { authApi, postAuth } from '@/lib/auth-client';
import { routes } from '@/lib/routes';
import { FormMessage } from './FormMessage';
import { SubmitButton } from './SubmitButton';

// Same rule as the server (EMAIL_RE in src/lib/auth.ts), checked by the browser first.
const IITK_EMAIL_PATTERN = '[A-Za-z0-9._%+\\-]+@iitk\\.ac\\.in';

/**
 * Registration form: posts to /api/auth/register. On success the account still
 * has to be verified from the emailed link, so the form is replaced by that
 * instruction.
 */
export function RegisterForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await postAuth(authApi.register, {
      name: form.get('name'),
      roll: form.get('roll'),
      email: form.get('email'),
      password: form.get('password'),
      terms: form.get('terms') === 'on',
    });
    setPending(false);
    if (result.ok) setSent(true);
    else setError(result.error);
  }

  if (sent) {
    return (
      <FormMessage tone="success">
        We have sent a verification link to your IITK email. Open it within 24 hours to activate
        your account, then sign in.
      </FormMessage>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex gap-4">
        <div className="flex-1">
          <Field
            label="Full name"
            name="name"
            type="text"
            required
            placeholder="Aarav Sharma"
            autoComplete="name"
          />
        </div>
        <div className="flex-1">
          <Field label="Roll number" name="roll" type="text" required placeholder="220123" />
        </div>
      </div>

      <Field
        label="IITK email address"
        name="email"
        type="email"
        required
        pattern={IITK_EMAIL_PATTERN}
        title="Use your @iitk.ac.in email address."
        placeholder="username@iitk.ac.in"
        autoComplete="email"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        minLength={8}
        maxLength={128}
        placeholder="At least 8 characters"
        autoComplete="new-password"
      />

      <div className="mt-1 flex items-center text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input
            name="terms"
            type="checkbox"
            required
            className="h-4 w-4 rounded-control border-line-strong text-accent accent-accent focus:ring-accent"
          />
          <span>
            I agree to the{' '}
            <Link href={routes.terms} className="font-bold text-accent-text hover:underline">
              community guidelines
            </Link>{' '}
            and{' '}
            <Link href={routes.privacy} className="font-bold text-accent-text hover:underline">
              privacy policy
            </Link>
            .
          </span>
        </label>
      </div>

      <SubmitButton pending={pending}>
        {pending ? 'Creating your account...' : 'Create my account'}
      </SubmitButton>
    </form>
  );
}
