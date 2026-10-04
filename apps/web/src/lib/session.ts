import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Role } from './roles';
import { routes } from './routes';

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
};

/**
 * The signed-in user, or null.
 *
 * Sign-in does not exist yet (CS455-17), so for now this only knows a
 * development user: under `next dev`, DEV_SESSION_ROLE=student or admin in
 * apps/web/.env.local signs you in with that role, and the optional
 * DEV_SESSION_EMAIL sets the account's email address. In every other
 * environment, including every production build, nobody is signed in.
 */
export const getSession = cache(async (): Promise<Session | null> => developmentSession());

/** For pages and server actions: the signed-in user, or a redirect to the sign-in page. */
export async function verifySession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(routes.login);
  return session;
}

function developmentSession(): Session | null {
  if (process.env.NODE_ENV !== 'development') return null;
  const role = process.env.DEV_SESSION_ROLE;
  if (role !== 'student' && role !== 'admin') return null;

  const email = developmentEmail();
  const defaultName = role === 'student' ? 'Test student' : 'Test admin';
  return {
    userId: `dev-${role}`,
    email: email ?? `test-${role}@iitk.ac.in`,
    // Like a new account before its profile is set up: named after the address.
    displayName: email ? email.split('@')[0] : defaultName,
    role,
  };
}

/** DEV_SESSION_EMAIL in lower case, if it looks like an email address. */
function developmentEmail(): string | undefined {
  const email = process.env.DEV_SESSION_EMAIL?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}
