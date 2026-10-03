'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/Field';
import { authApi, postAuth } from '@/lib/auth-client';
import { routes } from '@/lib/routes';
import { FormMessage } from './FormMessage';
import { SubmitButton } from './SubmitButton';

/** Sets a new password with the single-use token from a reset email (/api/auth/reset). */
export function NewPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await postAuth(authApi.reset, { token, password: form.get('password') });
    setPending(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success">
          Your password has been changed, and you have been signed out everywhere else.
        </FormMessage>
        <Link href={routes.login} className="font-bold text-accent-text">
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Field
        label="New password"
        name="password"
        type="password"
        required
        minLength={8}
        maxLength={128}
        hint="At least 8 characters. Pick one you do not use anywhere else."
        autoComplete="new-password"
      />
      <SubmitButton pending={pending}>{pending ? 'Saving...' : 'Set new password'}</SubmitButton>
    </form>
  );
}
