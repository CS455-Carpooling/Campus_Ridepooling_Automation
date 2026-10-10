import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from './session';

const h = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session | null>>(),
  guard: vi.fn<(action: string, ipLimit: number, windowSec: number) => Promise<Response | null>>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock('./session', () => ({ getSession: h.getSession }));
vi.mock('./auth', () => ({
  guard: h.guard,
  json: (body: object, status = 200) => Response.json(body, { status }),
}));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));

import { requireAdminApi, requireAdminPage } from './admin-auth';

const admin: Session = {
  userId: '6f1c2a5e-0000-4000-8000-000000000001',
  email: 'ops@iitk.ac.in',
  displayName: 'Ops Admin',
  role: 'admin',
};
const student: Session = { ...admin, email: 'ananya@iitk.ac.in', role: 'student' };

afterEach(() => {
  vi.clearAllMocks();
});

describe('requireAdminPage (SYS-FR-39, US-OA-19)', () => {
  it('sends someone signed out to the sign-in page', async () => {
    h.getSession.mockResolvedValue(null);
    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT /login');
  });

  it('gives null for a student, so the page shows that it is for admins', async () => {
    h.getSession.mockResolvedValue(student);
    await expect(requireAdminPage()).resolves.toBeNull();
  });

  it('gives the admin', async () => {
    h.getSession.mockResolvedValue(admin);
    await expect(requireAdminPage()).resolves.toEqual(admin);
  });
});

describe('requireAdminApi', () => {
  async function refusal(access: Awaited<ReturnType<typeof requireAdminApi>>) {
    if (!('response' in access)) throw new Error('expected a refusal');
    return { status: access.response.status, body: await access.response.json() };
  }

  it('answers 401 when signed out', async () => {
    h.getSession.mockResolvedValue(null);
    await expect(refusal(await requireAdminApi())).resolves.toEqual({
      status: 401,
      body: { error: 'Authentication required.', code: 'unauthenticated' },
    });
  });

  it('answers 403 to a student (SYS-FR-43)', async () => {
    h.getSession.mockResolvedValue(student);
    await expect(refusal(await requireAdminApi())).resolves.toEqual({
      status: 403,
      body: { error: 'Operations admins only.', code: 'not_admin' },
    });
  });

  it('gives the admin, and does not rate-limit reads', async () => {
    h.getSession.mockResolvedValue(admin);
    await expect(requireAdminApi()).resolves.toEqual({ admin });
    expect(h.guard).not.toHaveBeenCalled();
  });

  it('checks the origin and the per-IP limit for a change, before the session', async () => {
    h.guard.mockResolvedValue(Response.json({ error: 'Invalid request origin.' }, { status: 403 }));
    const access = await requireAdminApi({ write: true });
    expect(h.guard).toHaveBeenCalledWith('admin-action', 120, 900);
    expect((await refusal(access)).status).toBe(403);
    expect(h.getSession).not.toHaveBeenCalled();
  });

  it('gives the admin for a change that passes the guard', async () => {
    h.guard.mockResolvedValue(null);
    h.getSession.mockResolvedValue(admin);
    await expect(requireAdminApi({ write: true })).resolves.toEqual({ admin });
  });
});
