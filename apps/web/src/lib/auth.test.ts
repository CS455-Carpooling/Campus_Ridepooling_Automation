// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieJar, db, jsonPost, request, resetAuthMocks } from '../../test/auth-mocks';
import {
  appUrl,
  cleanup,
  clientIp,
  consumeToken,
  createSession,
  destroySession,
  fakeVerify,
  getCurrentUser,
  guard,
  hashPassword,
  issueToken,
  json,
  newToken,
  normalizeEmail,
  rateLimit,
  readJson,
  sameOrigin,
  sendMail,
  sendResetEmail,
  sendVerificationEmail,
  sha256,
  verifyPassword,
} from './auth';

vi.mock('./db', async () => (await import('../../test/auth-mocks')).dbModule);
vi.mock('next/headers', async () => (await import('../../test/auth-mocks')).headersModule);

beforeEach(() => {
  resetAuthMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('input helpers', () => {
  it('normalises email addresses and rejects non-strings', () => {
    expect(normalizeEmail('  Ananya@IITK.ac.in ')).toBe('ananya@iitk.ac.in');
    expect(normalizeEmail(42)).toBe('');
  });

  it('reads a JSON body, or an empty object for anything else', async () => {
    await expect(readJson(jsonPost({ a: 1 }))).resolves.toEqual({ a: 1 });
    await expect(readJson(jsonPost('not json'))).resolves.toEqual({});
    await expect(readJson(jsonPost('null'))).resolves.toEqual({});
  });

  it('answers JSON that is never cached', async () => {
    const response = json({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('takes the site address from APP_URL, without a trailing slash', () => {
    vi.stubEnv('APP_URL', 'https://rides.example.org/');
    expect(appUrl()).toBe('https://rides.example.org');
    vi.stubEnv('APP_URL', undefined as unknown as string);
    expect(appUrl()).toBe('http://localhost:3000');
  });
});

describe('passwords', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).toMatch(/^scrypt\$/);
    await expect(verifyPassword('correct horse battery', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', stored)).resolves.toBe(false);
  });

  it('salts every hash differently', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('spends the same effort on unknown accounts without failing', async () => {
    await expect(fakeVerify('anything')).resolves.toBeUndefined();
  });
});

describe('tokens', () => {
  it('makes long random tokens and stores only their hash', async () => {
    const token = newToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/);

    const raw = await issueToken('u1', 'verify', 60);
    expect(db.calls('DELETE FROM auth_tokens')[0]).toEqual(['u1', 'verify']);
    const [hash, userId, purpose, minutes] = db.calls('INSERT INTO auth_tokens')[0];
    expect([hash, userId, purpose, minutes]).toEqual([sha256(raw), 'u1', 'verify', 60]);
  });

  it('consumes a token once, returning its user', async () => {
    db.on('DELETE FROM auth_tokens WHERE token_hash', [{ user_id: 'u1' }]);
    await expect(consumeToken('raw', 'reset')).resolves.toBe('u1');
    db.on('DELETE FROM auth_tokens WHERE token_hash', []);
    await expect(consumeToken('raw', 'reset')).resolves.toBeNull();
  });
});

describe('abuse protection', () => {
  it('allows requests up to the limit', async () => {
    db.on('rate_limits', [{ count: 3 }]);
    await expect(rateLimit('login:x', 3, 60)).resolves.toBe(true);
    db.on('rate_limits', [{ count: 4 }]);
    await expect(rateLimit('login:x', 3, 60)).resolves.toBe(false);
  });

  it('identifies the client by the first forwarded address', async () => {
    await expect(clientIp()).resolves.toBe('203.0.113.7');
    request.headers = new Headers();
    await expect(clientIp()).resolves.toBe('unknown');
  });

  it('accepts only requests whose origin is this site', async () => {
    await expect(sameOrigin()).resolves.toBe(true);
    request.headers = new Headers({ origin: 'https://evil.example', host: 'localhost:3000' });
    await expect(sameOrigin()).resolves.toBe(false);
    request.headers = new Headers({ host: 'localhost:3000' });
    await expect(sameOrigin()).resolves.toBe(false);
    request.headers = new Headers({ origin: 'not a url', host: 'localhost:3000' });
    await expect(sameOrigin()).resolves.toBe(false);
    request.headers = new Headers({
      origin: 'https://rides.example.org',
      host: 'internal:3000',
      'x-forwarded-host': 'rides.example.org',
    });
    await expect(sameOrigin()).resolves.toBe(true);
  });

  it('guards a request: wrong origin, then too many attempts, then allowed', async () => {
    request.headers = new Headers({ origin: 'https://evil.example', host: 'localhost:3000' });
    expect((await guard('login', 5, 60))?.status).toBe(403);

    request.headers = new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' });
    db.on('rate_limits', [{ count: 6 }]);
    expect((await guard('login', 5, 60))?.status).toBe(429);

    db.on('rate_limits', [{ count: 1 }]);
    await expect(guard('login', 5, 60)).resolves.toBeNull();
  });

  it('cleans up expired sessions, tokens and limits', async () => {
    await cleanup();
    expect(db.calls('DELETE FROM sessions WHERE expires_at')).toHaveLength(1);
    expect(db.calls('DELETE FROM auth_tokens WHERE expires_at')).toHaveLength(1);
    expect(db.calls('DELETE FROM rate_limits')).toHaveLength(1);
  });
});

describe('sessions', () => {
  it('stores a hashed session and sets a long-lived cookie when asked to remember', async () => {
    await createSession('u1', true);
    const [name, token, options] = cookieJar.set.mock.calls[0];
    expect(name).toBe('crp_session');
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 30 * 86400 });
    expect(db.calls('INSERT INTO sessions')[0]).toEqual([sha256(token), 'u1', 30 * 86400]);
  });

  it('sets a browser-session cookie otherwise', async () => {
    await createSession('u1', false);
    expect(cookieJar.set.mock.calls[0][2]).not.toHaveProperty('maxAge');
    expect(db.calls('INSERT INTO sessions')[0][2]).toBe(86400);
  });

  it('finds the user of a valid session cookie', async () => {
    await expect(getCurrentUser()).resolves.toBeNull();

    cookieJar.store.set('crp_session', 'token-1');
    const user = { id: 'u1', email: 'a@iitk.ac.in', full_name: 'A', roll_number: '1' };
    db.on('FROM sessions s', [user]);
    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(db.calls('FROM sessions s')[0]).toEqual([sha256('token-1')]);

    db.on('FROM sessions s', []);
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('signs out by deleting the session and the cookie', async () => {
    await destroySession();
    expect(db.calls('DELETE FROM sessions WHERE token_hash')).toHaveLength(0);

    cookieJar.store.set('crp_session', 'token-1');
    await destroySession();
    expect(db.calls('DELETE FROM sessions WHERE token_hash')[0]).toEqual([sha256('token-1')]);
    expect(cookieJar.delete).toHaveBeenCalledWith('crp_session');
  });
});

describe('email', () => {
  it('prints emails to the console in development when no relay is set', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sendMail('a@iitk.ac.in', 'Subject', 'Body');
    expect(log.mock.calls[0][0]).toContain('to=a@iitk.ac.in');
  });

  it('reports a missing relay in production instead of printing the email', async () => {
    // auth.ts reads NODE_ENV when it loads, so load a fresh copy as production.
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const production = await import('./auth');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await production.sendMail('a@iitk.ac.in', 'Subject', 'Body');
    expect(error.mock.calls[0][0]).toContain('MAIL_SCRIPT_URL');
  });

  it('sends through the relay, escaping HTML and linking addresses', async () => {
    vi.stubEnv('MAIL_SCRIPT_URL', 'https://mail.example/relay');
    vi.stubEnv('MAIL_SCRIPT_SECRET', 'test-secret');
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await sendMail('a@iitk.ac.in', 'Hello', 'Use <b> https://x.example/a\nThanks');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://mail.example/relay');
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ secret: 'test-secret', to: 'a@iitk.ac.in', subject: 'Hello' });
    expect(sent.body).toBe(
      'Use &lt;b&gt; <a href="https://x.example/a">https://x.example/a</a><br>Thanks',
    );
  });

  it('logs relay failures without throwing', async () => {
    vi.stubEnv('MAIL_SCRIPT_URL', 'https://mail.example/relay');
    vi.stubEnv('MAIL_SCRIPT_SECRET', 'test-secret');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: false, error: 'quota' })),
    );
    await sendMail('a@iitk.ac.in', 'S', 'B');
    expect(error).toHaveBeenCalledWith('Mail script error:', 'quota');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 502 })),
    );
    await sendMail('a@iitk.ac.in', 'S', 'B');
    expect(error).toHaveBeenCalledWith('Mail script error:', 502);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await sendMail('a@iitk.ac.in', 'S', 'B');
    expect(error.mock.calls.at(-1)?.[0]).toBe('Email send failed');
  });

  it('emails verification and reset links with fresh tokens', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sendVerificationEmail('u1', 'a@iitk.ac.in');
    await sendResetEmail('u1', 'a@iitk.ac.in');
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(2));
    expect(log.mock.calls[0][0]).toContain('http://localhost:3000/api/auth/verify?token=');
    expect(log.mock.calls[1][0]).toContain('http://localhost:3000/reset-password?token=');
    expect(db.calls('INSERT INTO auth_tokens').map((params) => params[2])).toEqual([
      'verify',
      'reset',
    ]);
  });
});
