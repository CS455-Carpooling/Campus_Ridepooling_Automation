// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, resetAuthMocks } from '../../../../../test/auth-mocks';
import { GET } from './route';

vi.mock('@/lib/db', async () => (await import('../../../../../test/auth-mocks')).dbModule);
vi.mock('next/headers', async () => (await import('../../../../../test/auth-mocks')).headersModule);

beforeEach(() => {
  resetAuthMocks();
});

const verify = (token?: string) =>
  GET(
    new Request(
      `http://localhost:3000/api/auth/verify${token === undefined ? '' : `?token=${token}`}`,
    ),
  );
const longToken = 'x'.repeat(43);

describe('GET /api/auth/verify', () => {
  it('verifies the account and sends the user to sign in', async () => {
    db.on('DELETE FROM auth_tokens', [{ user_id: 'u1' }]);
    const response = await verify(longToken);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?notice=verified');
    expect(db.calls('UPDATE users SET email_verified_at')[0]).toEqual(['u1']);
  });

  it('reports an unknown, used or expired link', async () => {
    const response = await verify(longToken);
    expect(response.headers.get('location')).toContain('notice=verify_failed');
  });

  it('does not look up missing or short tokens', async () => {
    for (const token of [undefined, 'short']) {
      const response = await verify(token);
      expect(response.headers.get('location')).toContain('notice=verify_failed');
    }
    expect(db.calls('DELETE FROM auth_tokens')).toHaveLength(0);
  });

  it('stops after too many attempts from one address', async () => {
    db.on('rate_limits', [{ count: 31 }]);
    db.on('DELETE FROM auth_tokens', [{ user_id: 'u1' }]);
    const response = await verify(longToken);
    expect(response.headers.get('location')).toContain('notice=verify_failed');
    expect(db.calls('UPDATE users')).toHaveLength(0);
  });
});
