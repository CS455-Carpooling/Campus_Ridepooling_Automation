import 'server-only';
import { redirect } from 'next/navigation';
import { guard, json } from './auth';
import { routes } from './routes';
import { getSession, type Session } from './session';

/** A signed-in operations admin. */
export type AdminSession = Session & { role: 'admin' };

const isAdmin = (session: Session): session is AdminSession => session.role === 'admin';

/**
 * For admin pages (SYS-FR-39, SYS-NFR-03): the signed-in admin, or null for anyone else, so
 * the page can show <AdminNotAllowed /> instead of its content. Someone signed out goes to
 * the sign-in page. Every admin page calls this itself: layouts are not re-run on navigation.
 */
export async function requireAdminPage(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session) redirect(routes.login);
  return isAdmin(session) ? session : null;
}

export type AdminApiAccess = { admin: AdminSession } | { response: Response };

/**
 * For admin API routes: the signed-in admin, or the response to send instead (401 signed
 * out, 403 anyone else). Routes that change something pass `write`, which also applies the
 * same-origin check and a per-IP limit, as every other state-changing API does.
 */
export async function requireAdminApi(options: { write?: boolean } = {}): Promise<AdminApiAccess> {
  if (options.write) {
    const blocked = await guard('admin-action', 120, 900);
    if (blocked) return { response: blocked };
  }
  const session = await getSession();
  if (!session) {
    return { response: json({ error: 'Authentication required.', code: 'unauthenticated' }, 401) };
  }
  if (!isAdmin(session)) {
    return { response: json({ error: 'Operations admins only.', code: 'not_admin' }, 403) };
  }
  return { admin: session };
}
