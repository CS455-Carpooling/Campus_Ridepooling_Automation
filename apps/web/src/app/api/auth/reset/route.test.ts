// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, jsonPost, request, resetAuthMocks } from '../../../../../test/auth-mocks';
import { POST } from './route';

vi.mock('@/lib/db', async () => (await import('../../../../../test/auth-mocks')).dbModule);
vi.mock('next/headers', async () => (await import('../../../../../test/auth-mocks')).headersModule);

beforeEach(() => {
  resetAuthMocks();
});

async function reset(body: unknown) {
  const response = await POST(jsonPost(body));
  return { status: response.status, body: await response.json() };
}

describe('POST /api/auth/reset', () => {
  it('sets the new password and signs the account out everywhere', async () => {
    db.on('DELETE FROM auth_tokens', [{ user_id: 'u1' }]);
    await expect(reset({ token: 'raw', password: 'a new long password' })).resolves.toEqual({
      status: 200,
      body: { ok: true },
    });
    const [hash, userId] = db.calls('UPDATE users SET password_hash')[0];
    expect(hash).toMatch(/^scrypt\$/);
    expect(userId).toBe('u1');
    expect(db.calls('DELETE FROM sessions WHERE user_id')[0]).toEqual(['u1']);
  });

  it('rejects an invalid or used link', async () => {
    await expect(reset({ token: 'raw', password: 'a new long password' })).resolves.toEqual({
      status: 400,
      body: { error: 'This reset link is invalid or has expired.' },
    });
    await expect(reset({ password: 'a new long password' })).resolves.toMatchObject({
      status: 400,
    });
  });

  it('rejects a password that is too short, before using the token', async () => {
    await expect(reset({ token: 'raw', password: 'short' })).resolves.toMatchObject({
      status: 400,
    });
    await expect(reset({ token: 'raw', password: 42 })).resolves.toMatchObject({ status: 400 });
    expect(db.calls('DELETE FROM auth_tokens')).toHaveLength(0);
  });

  it('refuses requests from other sites', async () => {
    request.headers = new Headers({ origin: 'https://evil.example', host: 'localhost:3000' });
    await expect(reset({ token: 'raw', password: 'long enough' })).resolves.toMatchObject({
      status: 403,
    });
  });
});
