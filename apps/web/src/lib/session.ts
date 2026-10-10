import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getCurrentUser } from './auth';
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
 * This is the account signed in through /login: getCurrentUser() in auth.ts
 * reads it from the session cookie, with its role from the database. Every
 * account is a student unless an operator made it an admin with
 * `npm run admin:grant` (CS455-48); the role is read again on every request,
 * so a revoked admin loses access at once.
 *
 * Under `next dev` only, when nobody is signed in, DEV_SESSION_ROLE=student or
 * admin in apps/web/.env.local still gives a test user with that role (the
 * optional DEV_SESSION_EMAIL sets its address). The test admin can look at the
 * admin screens but not change anything, since changes are audited against a
 * real account. Production builds ignore it.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getCurrentUser();
  if (user) {
    return {
      userId: user.id,
      email: user.email,
      displayName: user.full_name,
      role: user.role === 'admin' ? 'admin' : 'student',
    };
  }
  return developmentSession();
});

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
