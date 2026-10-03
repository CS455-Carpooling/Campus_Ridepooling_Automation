'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/Field';
import { authApi, postAuth } from '@/lib/auth-client';
import { routes } from '@/lib/routes';
import { FormMessage } from './FormMessage';
import { SubmitButton } from './SubmitButton';

/** Sign-in form: posts to /api/auth/login and opens the home page on success. */
export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await postAuth(authApi.login, {
      email: form.get('email'),
      password: form.get('password'),
      remember: form.get('remember') === 'on',
    });
    if (result.ok) {
      router.push(routes.home);
      router.refresh();
      return;
    }
    setError(result.error);
    setPending(false);
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
        autoComplete="username"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        placeholder="At least 8 characters"
        autoComplete="current-password"
      />

      <div className="mt-1 flex items-center justify-between text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input
            name="remember"
            type="checkbox"
            className="h-4 w-4 rounded-control border-line-strong text-accent accent-accent focus:ring-accent"
          />
          Keep me signed in
        </label>
        <Link
          href={routes.forgotPassword}
          className="font-semibold text-accent-text hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <SubmitButton pending={pending}>
        {pending ? 'Signing in...' : 'Log in to Campus Ride-Pooling'}
      </SubmitButton>
    </form>
  );
}
