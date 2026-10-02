import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSession, verifySession } from './session';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock('next/navigation', () => ({ redirect }));

afterEach(() => {
  vi.unstubAllEnvs();
  redirect.mockClear();
});

describe('getSession (development stub until sign-in exists)', () => {
  it('signs in a test student under next dev', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_SESSION_ROLE', 'student');
    vi.stubEnv('DEV_SESSION_EMAIL', '');
    await expect(getSession()).resolves.toEqual({
      userId: 'dev-student',
      email: 'test-student@iitk.ac.in',
      displayName: 'Test student',
      role: 'student',
    });
  });

  it('signs in a test admin under next dev', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_SESSION_ROLE', 'admin');
    vi.stubEnv('DEV_SESSION_EMAIL', '');
    await expect(getSession()).resolves.toMatchObject({
      email: 'test-admin@iitk.ac.in',
      displayName: 'Test admin',
      role: 'admin',
    });
  });

  it('uses DEV_SESSION_EMAIL as the account and names the user after it', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_SESSION_ROLE', 'student');
    vi.stubEnv('DEV_SESSION_EMAIL', '  Test.Student@Example.ORG ');
    await expect(getSession()).resolves.toMatchObject({
      email: 'test.student@example.org',
      displayName: 'test.student',
      role: 'student',
    });
  });

  it('ignores a DEV_SESSION_EMAIL that is not an email address', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_SESSION_ROLE', 'admin');
    vi.stubEnv('DEV_SESSION_EMAIL', 'not-an-email');
    await expect(getSession()).resolves.toMatchObject({
      email: 'test-admin@iitk.ac.in',
      displayName: 'Test admin',
    });
  });

  it('is signed out when DEV_SESSION_ROLE is empty or unknown', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_SESSION_ROLE', '');
    await expect(getSession()).resolves.toBeNull();
    vi.stubEnv('DEV_SESSION_ROLE', 'superuser');
    await expect(getSession()).resolves.toBeNull();
  });

  it('ignores DEV_SESSION_ROLE in a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEV_SESSION_ROLE', 'admin');
    await expect(getSession()).resolves.toBeNull();
  });

  it('ignores DEV_SESSION_ROLE in tests and other environments', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DEV_SESSION_ROLE', 'student');
    await expect(getSession()).resolves.toBeNull();
  });
});

describe('verifySession', () => {
  it('returns the session when someone is signed in', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_SESSION_ROLE', 'student');
    await expect(verifySession()).resolves.toMatchObject({ role: 'student' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to the sign-in page when nobody is signed in', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(verifySession()).rejects.toThrow('NEXT_REDIRECT /login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
