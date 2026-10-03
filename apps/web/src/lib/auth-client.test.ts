import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi, postAuth } from './auth-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postAuth', () => {
  it('posts the form as JSON and reports success', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(postAuth(authApi.login, { email: 'a@iitk.ac.in' })).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":"a@iitk.ac.in"}',
    });
  });

  it("passes on the server's message", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Invalid email or password.' }, { status: 401 })),
    );
    await expect(postAuth(authApi.login, {})).resolves.toEqual({
      ok: false,
      error: 'Invalid email or password.',
    });
  });

  it('falls back to a general message when the answer is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad gateway', { status: 502 })),
    );
    await expect(postAuth(authApi.register, {})).resolves.toEqual({
      ok: false,
      error: 'Something went wrong. Please try again.',
    });
  });

  it('explains a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(postAuth(authApi.forgot, {})).resolves.toEqual({
      ok: false,
      error: 'Network error. Check your connection and try again.',
    });
  });
});
