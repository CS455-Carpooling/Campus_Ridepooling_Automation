// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieJar, db, request, resetAuthMocks } from '../../../../../test/auth-mocks';
import { POST } from './route';

vi.mock('@/lib/db', async () => (await import('../../../../../test/auth-mocks')).dbModule);
vi.mock('next/headers', async () => (await import('../../../../../test/auth-mocks')).headersModule);

beforeEach(() => {
  resetAuthMocks();
});

describe('POST /api/auth/logout', () => {
  it('ends the session and sends the user to the sign-in page', async () => {
    cookieJar.store.set('crp_session', 'token-1');
    const response = await POST();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    expect(db.calls('DELETE FROM sessions WHERE token_hash')).toHaveLength(1);
    expect(cookieJar.store.has('crp_session')).toBe(false);
  });

  it('refuses requests from other sites', async () => {
    request.headers = new Headers({ origin: 'https://evil.example', host: 'localhost:3000' });
    expect((await POST()).status).toBe(403);
  });
});
