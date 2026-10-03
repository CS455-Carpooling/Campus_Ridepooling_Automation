// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, jsonPost, request, resetAuthMocks } from '../../../../../test/auth-mocks';
import { POST } from './route';

vi.mock('@/lib/db', async () => (await import('../../../../../test/auth-mocks')).dbModule);
vi.mock('next/headers', async () => (await import('../../../../../test/auth-mocks')).headersModule);

let mailLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetAuthMocks();
  mailLog = vi.spyOn(console, 'log').mockImplementation(() => {});
});

async function forgot(email: unknown) {
  const response = await POST(jsonPost({ email }));
  return { status: response.status, body: await response.json() };
}

describe('POST /api/auth/forgot', () => {
  it('emails a reset link to a verified account', async () => {
    db.on('FROM users WHERE email', [{ id: 'u1' }]);
    await expect(forgot('Ananya@iitk.ac.in')).resolves.toEqual({ status: 200, body: { ok: true } });
    await vi.waitFor(() => expect(mailLog.mock.calls[0][0]).toContain('/reset-password?token='));
  });

  it('answers the same way when there is no such account, and sends nothing', async () => {
    await expect(forgot('nobody@iitk.ac.in')).resolves.toEqual({ status: 200, body: { ok: true } });
    await expect(forgot('someone@gmail.com')).resolves.toEqual({ status: 200, body: { ok: true } });
    expect(db.calls('INSERT INTO auth_tokens')).toHaveLength(0);
    expect(mailLog).not.toHaveBeenCalled();
  });

  it('refuses requests from other sites', async () => {
    request.headers = new Headers({ origin: 'https://evil.example', host: 'localhost:3000' });
    await expect(forgot('ananya@iitk.ac.in')).resolves.toMatchObject({ status: 403 });
  });
});
