import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, verifySession } from './session';

type Account = { id: string; email: string; full_name: string; roll_number: string };

const { getCurrentUser, redirect } = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<Account | null>>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock('./auth', () => ({ getCurrentUser }));
vi.mock('next/navigation', () => ({ redirect }));

const account: Account = {
  id: '6f1c2a5e-0000-4000-8000-000000000001',
  email: 'ananya@iitk.ac.in',
  full_name: 'Ananya Rao',
  roll_number: '220123',
};

beforeEach(() => {
  getCurrentUser.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  redirect.mockClear();
  getCurrentUser.mockReset();
});

describe('getSession with an account signed in through /login', () => {
  it('is that account, as a student', async () => {
    getCurrentUser.mockResolvedValue(account);
    await expect(getSession()).resolves.toEqual({
      userId: account.id,
      email: 'ananya@iitk.ac.in',
      displayName: 'Ananya Rao',
      role: 'student',
    });
  });

  it('comes before the development user', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_SESSION_ROLE', 'admin');
    getCurrentUser.mockResolvedValue(account);
    await expect(getSession()).resolves.toMatchObject({ userId: account.id, role: 'student' });
  });

  it('works in a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getCurrentUser.mockResolvedValue(account);
    await expect(getSession()).resolves.toMatchObject({ email: 'ananya@iitk.ac.in' });
  });
});

describe('getSession without a signed-in account (development user)', () => {
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
  it('returns the signed-in account', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getCurrentUser.mockResolvedValue(account);
    await expect(verifySession()).resolves.toMatchObject({ userId: account.id });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('returns the development user under next dev', async () => {
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
