import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
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
 * Under `next dev`, DEV_SESSION_ROLE=student or admin in apps/web/.env.local
 * signs you in as a development user with that role (the optional
 * DEV_SESSION_EMAIL sets its address), so pages can be built without a
 * database. Otherwise the user comes from the session cookie set by
 * /api/auth/login (CS455-19), when a database is configured.
 */
export const getSession = cache(
  async (): Promise<Session | null> => developmentSession() ?? (await accountSession()),
);

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

/**
 * The user behind the session cookie. Every registered account is a student;
 * operations admins are given their role separately (not built yet).
 */
async function accountSession(): Promise<Session | null> {
  // The answer depends on the request's cookie, so never prerender it at build time
  // (that would bake "signed out" into every page that shows the session).
  await connection();
  if (!process.env.DATABASE_URL) return null;
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    return { userId: user.id, email: user.email, displayName: user.full_name, role: 'student' };
  } catch (error) {
    // A database outage must not take every page down; treat it as signed out.
    console.error('Could not read the session', error);
    return null;
  }
}

/** DEV_SESSION_EMAIL in lower case, if it looks like an email address. */
function developmentEmail(): string | undefined {
  const email = process.env.DEV_SESSION_EMAIL?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}
