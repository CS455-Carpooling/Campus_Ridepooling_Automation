// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, jsonPost, request, resetAuthMocks } from '../../../../../test/auth-mocks';
import { POST } from './route';

vi.mock('@/lib/db', async () => (await import('../../../../../test/auth-mocks')).dbModule);
vi.mock('next/headers', async () => (await import('../../../../../test/auth-mocks')).headersModule);

const valid = {
  name: '  Ananya   Rao ',
  roll: '230001',
  email: 'Ananya@iitk.ac.in',
  password: 'correct horse battery',
  terms: true,
};

let mailLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetAuthMocks();
  mailLog = vi.spyOn(console, 'log').mockImplementation(() => {});
});

async function register(body: unknown) {
  const response = await POST(jsonPost(body));
  return { status: response.status, body: await response.json() };
}

describe('POST /api/auth/register', () => {
  it('creates the account and emails a verification link', async () => {
    db.on('INSERT INTO users', [{ id: 'u1' }]);
    await expect(register(valid)).resolves.toEqual({ status: 200, body: { ok: true } });

    const [email, name, roll, hash] = db.calls('INSERT INTO users')[0];
    expect([email, name, roll]).toEqual(['ananya@iitk.ac.in', 'Ananya Rao', '230001']);
    expect(hash).toMatch(/^scrypt\$/);
    await vi.waitFor(() => expect(mailLog.mock.calls[0][0]).toContain('/api/auth/verify?token='));
  });

  it('resends the link to an unverified account without changing its password', async () => {
    db.on('FROM users WHERE email', [{ id: 'u1', email_verified_at: null }]);
    await expect(register(valid)).resolves.toMatchObject({ status: 200 });
    expect(db.calls('UPDATE users')).toHaveLength(0);
    await vi.waitFor(() => expect(mailLog.mock.calls[0][0]).toContain('/api/auth/verify?token='));
  });

  it('tells the owner of an existing account, and answers the same way', async () => {
    db.on('FROM users WHERE email', [{ id: 'u1', email_verified_at: new Date() }]);
    await expect(register(valid)).resolves.toEqual({ status: 200, body: { ok: true } });
    await vi.waitFor(() => expect(mailLog.mock.calls[0][0]).toContain('already have an account'));
  });

  it.each([
    [{ email: 'ananya@gmail.com' }, 'Please use your @iitk.ac.in email address.'],
    [{ name: 'A' }, 'Please enter your full name.'],
    [{ roll: '23 0001' }, 'Please enter a valid roll number.'],
    [{ password: 'short' }, 'Password must be 8 to 128 characters.'],
    [{ terms: false }, 'Please accept the guidelines and privacy policy.'],
  ])('rejects %o', async (change, error) => {
    await expect(register({ ...valid, ...change })).resolves.toEqual({
      status: 400,
      body: { error },
    });
    expect(db.calls('INSERT INTO users')).toHaveLength(0);
  });

  it('accepts only strings for every field', async () => {
    const result = await register({ email: 1, name: 2, roll: 3, password: 4, terms: true });
    expect(result.status).toBe(400);
  });

  it('limits sign-ups per email address', async () => {
    db.handlers.unshift((sql, params) =>
      sql.includes('rate_limits') && String(params[0]).startsWith('register:ananya')
        ? { rows: [{ count: 4 }] }
        : undefined,
    );
    await expect(register(valid)).resolves.toMatchObject({ status: 429 });
  });

  it('refuses requests from other sites', async () => {
    request.headers = new Headers({ origin: 'https://evil.example', host: 'localhost:3000' });
    await expect(register(valid)).resolves.toMatchObject({ status: 403 });
  });
});
