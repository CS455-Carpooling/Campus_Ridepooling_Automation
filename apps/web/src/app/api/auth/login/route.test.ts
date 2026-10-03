// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/auth';
import { cookieJar, db, jsonPost, request, resetAuthMocks } from '../../../../../test/auth-mocks';
import { POST } from './route';

vi.mock('@/lib/db', async () => (await import('../../../../../test/auth-mocks')).dbModule);
vi.mock('next/headers', async () => (await import('../../../../../test/auth-mocks')).headersModule);

let passwordHash = '';
beforeAll(async () => {
  passwordHash = await hashPassword('correct horse battery');
});

beforeEach(() => {
  resetAuthMocks();
});

const account = (verified = true) => [
  { id: 'u1', password_hash: passwordHash, email_verified_at: verified ? new Date() : null },
];

async function login(body: unknown) {
  const response = await POST(jsonPost(body));
  return { status: response.status, body: await response.json() };
}

describe('POST /api/auth/login', () => {
  it('signs in a verified account and sets the session cookie', async () => {
    db.on('FROM users WHERE email', account());
    const result = await login({
      email: ' Ananya@IITK.ac.in ',
      password: 'correct horse battery',
      remember: true,
    });
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(db.calls('FROM users WHERE email')[0]).toEqual(['ananya@iitk.ac.in']);
    expect(cookieJar.set).toHaveBeenCalledWith(
      'crp_session',
      expect.any(String),
      expect.objectContaining({ maxAge: 30 * 86400 }),
    );
  });

  it('now and then clears out expired sessions after a sign-in', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    db.on('FROM users WHERE email', account());
    await login({ email: 'ananya@iitk.ac.in', password: 'correct horse battery' });
    await vi.waitFor(() => expect(db.calls('DELETE FROM rate_limits')).toHaveLength(1));
    vi.restoreAllMocks();
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const unknown = await login({ email: 'nobody@iitk.ac.in', password: 'whatever1' });
    db.on('FROM users WHERE email', account());
    const wrong = await login({ email: 'ananya@iitk.ac.in', password: 'not the password' });
    expect(unknown).toEqual(wrong);
    expect(wrong).toEqual({ status: 401, body: { error: 'Invalid email or password.' } });
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it('rejects a missing email or password', async () => {
    await expect(login({ email: 'ananya@iitk.ac.in' })).resolves.toMatchObject({ status: 401 });
  });

  it('asks unverified accounts to verify first', async () => {
    db.on('FROM users WHERE email', account(false));
    const result = await login({ email: 'ananya@iitk.ac.in', password: 'correct horse battery' });
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/verify your email/);
  });

  it('limits attempts per email address', async () => {
    db.handlers.unshift((sql, params) =>
      sql.includes('rate_limits') && String(params[0]).startsWith('login:ananya')
        ? { rows: [{ count: 11 }] }
        : undefined,
    );
    const result = await login({ email: 'ananya@iitk.ac.in', password: 'whatever1' });
    expect(result.status).toBe(429);
  });

  it('refuses requests from other sites', async () => {
    request.headers = new Headers({ origin: 'https://evil.example', host: 'localhost:3000' });
    await expect(login({})).resolves.toMatchObject({ status: 403 });
  });
});
