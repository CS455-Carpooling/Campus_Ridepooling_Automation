'use client';

import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/Field';
import { authApi, postAuth } from '@/lib/auth-client';
import { FormMessage } from './FormMessage';
import { SubmitButton } from './SubmitButton';

/**
 * Asks for a password reset link (/api/auth/forgot). The server answers the
 * same way whether or not the account exists, and so does this form.
 */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await postAuth(authApi.forgot, { email: form.get('email') });
    setPending(false);
    if (result.ok) setSent(true);
    else setError(result.error);
  }

  if (sent) {
    return (
      <FormMessage tone="success">
        If an account exists for that email, we have sent a reset link. It expires in 30 minutes.
      </FormMessage>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Field
        label="IITK email address"
        name="email"
        type="email"
        required
        placeholder="username@iitk.ac.in"
        autoComplete="email"
      />
      <SubmitButton pending={pending}>{pending ? 'Sending...' : 'Send reset link'}</SubmitButton>
    </form>
  );
}
