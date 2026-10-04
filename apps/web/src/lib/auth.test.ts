// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from './auth';

const h = vi.hoisted(() => ({
  jar: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  query: vi.fn(),
  state: { headers: new Headers() },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => h.jar),
  headers: vi.fn(async () => h.state.headers),
}));
vi.mock('./db', () => ({ pool: { query: h.query } }));

const setHeaders = (o: Record<string, string>) => {
  h.state.headers = new Headers(o);
};

async function loadProd() {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'production');
  return import('./auth');
}

beforeEach(() => {
  h.query.mockReset();
  h.query.mockResolvedValue({ rows: [] });
  h.jar.get.mockReset();
  h.jar.set.mockReset();
  h.jar.delete.mockReset();
  setHeaders({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('validation helpers', () => {
  it('appUrl falls back to localhost and strips a trailing slash', () => {
    vi.stubEnv('APP_URL', undefined);
    expect(auth.appUrl()).toBe('http://localhost:3000');
    vi.stubEnv('APP_URL', 'https://app.test/');
    expect(auth.appUrl()).toBe('https://app.test');
  });

  it('EMAIL_RE accepts only iitk.ac.in addresses', () => {
    expect(auth.EMAIL_RE.test('ananya@iitk.ac.in')).toBe(true);
    expect(auth.EMAIL_RE.test('ananya@gmail.com')).toBe(false);
    expect(auth.EMAIL_RE.test('ananya@iitk.ac.in.evil.com')).toBe(false);
    expect(auth.EMAIL_RE.test('x@mail.iitk.ac.in')).toBe(false);
  });

  it('normalizeEmail trims, lowercases and truncates; rejects non-strings', () => {
    expect(auth.normalizeEmail('  A@IITK.ac.in ')).toBe('a@iitk.ac.in');
    expect(auth.normalizeEmail('a'.repeat(300))).toHaveLength(254);
    expect(auth.normalizeEmail(42)).toBe('');
    expect(auth.normalizeEmail(undefined)).toBe('');
  });

  it('json sets the status and disables caching', async () => {
    const res = auth.json({ a: 1 }, 418);
    expect(res.status).toBe(418);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ a: 1 });
    expect(auth.json({}).status).toBe(200);
  });

  it('readJson returns objects and falls back to {} otherwise', async () => {
    const req = (body: string) => new Request('http://x', { method: 'POST', body });
    expect(await auth.readJson(req('{"a":1}'))).toEqual({ a: 1 });
    expect(await auth.readJson(req('null'))).toEqual({});
    expect(await auth.readJson(req('5'))).toEqual({});
    expect(await auth.readJson(req('not json'))).toEqual({});
  });
});

describe('passwords', { timeout: 30000 }, () => {
  it('hashes with a per-user salt and verifies correctly', async () => {
    const a = await auth.hashPassword('correct horse');
    const b = await auth.hashPassword('correct horse');
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(a).not.toBe(b);
    expect(await auth.verifyPassword('correct horse', a)).toBe(true);
    expect(await auth.verifyPassword('wrong horse', a)).toBe(false);
  });

  it('fakeVerify resolves without throwing, including on repeat calls', async () => {
    await expect(auth.fakeVerify('x')).resolves.toBeUndefined();
    await expect(auth.fakeVerify('y')).resolves.toBeUndefined();
  });
});

describe('tokens', () => {
  it('newToken is random and sha256 matches a known vector', () => {
    expect(auth.newToken()).not.toBe(auth.newToken());
    expect(auth.newToken().length).toBeGreaterThanOrEqual(43);
    expect(auth.sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('issueToken replaces old tokens and stores only the hash', async () => {
    const raw = await auth.issueToken('u1', 'verify', 60);
    expect(h.query).toHaveBeenCalledTimes(2);
    expect(h.query.mock.calls[0][0]).toMatch(/DELETE FROM auth_tokens/);
    expect(h.query.mock.calls[0][1]).toEqual(['u1', 'verify']);
    expect(h.query.mock.calls[1][1]).toEqual([auth.sha256(raw), 'u1', 'verify', 60]);
  });

  it('consumeToken returns the user id, or null when nothing matched', async () => {
    h.query.mockResolvedValueOnce({ rows: [{ user_id: 'u9' }] });
    expect(await auth.consumeToken('raw', 'reset')).toBe('u9');
    expect(h.query.mock.calls[0][1]).toEqual([auth.sha256('raw'), 'reset']);
    h.query.mockResolvedValueOnce({ rows: [] });
    expect(await auth.consumeToken('raw', 'reset')).toBeNull();
  });
});

describe('rate limiting and request guards', () => {
  it('rateLimit allows up to the limit and truncates long keys', async () => {
    h.query.mockResolvedValueOnce({ rows: [{ count: 3 }] });
    expect(await auth.rateLimit('k', 3, 60)).toBe(true);
    h.query.mockResolvedValueOnce({ rows: [{ count: 4 }] });
    expect(await auth.rateLimit('k'.repeat(400), 3, 60)).toBe(false);
    expect(h.query.mock.calls[1][1][0]).toHaveLength(300);
  });

  it('clientIp uses the first forwarded address, else "unknown"', async () => {
    setHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(await auth.clientIp()).toBe('1.2.3.4');
    setHeaders({});
    expect(await auth.clientIp()).toBe('unknown');
  });

  it('sameOrigin trusts sec-fetch-site, then compares Origin with the host', async () => {
    setHeaders({ 'sec-fetch-site': 'same-origin' });
    expect(await auth.sameOrigin()).toBe(true);
    setHeaders({ origin: 'http://localhost:3000', host: 'localhost:3000' });
    expect(await auth.sameOrigin()).toBe(true);
    setHeaders({
      origin: 'https://app.test',
      host: 'internal:8080',
      'x-forwarded-host': 'app.test',
    });
    expect(await auth.sameOrigin()).toBe(true);
    setHeaders({ origin: 'https://evil.test', host: 'app.test' });
    expect(await auth.sameOrigin()).toBe(false);
    setHeaders({ host: 'app.test' });
    expect(await auth.sameOrigin()).toBe(false);
    setHeaders({ origin: 'not a url', host: 'app.test' });
    expect(await auth.sameOrigin()).toBe(false);
  });

  it('guard rejects a foreign origin with 403 before touching the database', async () => {
    const res = await auth.guard('login', 5, 60);
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: 'Invalid request origin.' });
    expect(h.query).not.toHaveBeenCalled();
  });

  it('guard returns 429 when the per-IP limit is exceeded', async () => {
    setHeaders({ 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '9.9.9.9' });
    h.query.mockResolvedValueOnce({ rows: [{ count: 99 }] });
    const res = await auth.guard('act', 5, 60);
    expect(res?.status).toBe(429);
    expect(h.query.mock.calls[0][1][0]).toBe('act:ip:9.9.9.9');
  });

  it('guard returns null when the request is allowed', async () => {
    setHeaders({ 'sec-fetch-site': 'same-origin' });
    h.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    expect(await auth.guard('act', 5, 60)).toBeNull();
  });

  it('cleanup deletes expired sessions, tokens and rate limits', async () => {
    await auth.cleanup();
    const sql = h.query.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/sessions/);
    expect(sql).toMatch(/auth_tokens/);
    expect(sql).toMatch(/rate_limits/);
  });
});

describe('sessions', () => {
  it('createSession stores the token hash and sets a session cookie', async () => {
    await auth.createSession('u1', false);
    const [name, token, opts] = h.jar.set.mock.calls[0];
    expect(name).toBe('crp_session');
    expect(opts).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
    expect(opts).not.toHaveProperty('maxAge');
    expect(h.query.mock.calls[0][1]).toEqual([auth.sha256(token), 'u1', 86400]);
  });

  it('createSession with "remember" lasts 30 days', async () => {
    await auth.createSession('u1', true);
    expect(h.jar.set.mock.calls[0][2]).toMatchObject({ maxAge: 30 * 86400 });
    expect(h.query.mock.calls[0][1][2]).toBe(30 * 86400);
  });

  it('uses a __Host- secure cookie in production', async () => {
    const prod = await loadProd();
    await prod.createSession('u1', false);
    expect(h.jar.set.mock.calls[0][0]).toBe('__Host-crp_session');
    expect(h.jar.set.mock.calls[0][2]).toMatchObject({ secure: true });
  });

  it('getCurrentUser returns null without a cookie', async () => {
    h.jar.get.mockReturnValue(undefined);
    expect(await auth.getCurrentUser()).toBeNull();
    expect(h.query).not.toHaveBeenCalled();
  });

  it('getCurrentUser looks the session up by hash', async () => {
    h.jar.get.mockReturnValue({ value: 'tok' });
    h.query.mockResolvedValueOnce({ rows: [{ id: '1', email: 'a@iitk.ac.in' }] });
    expect(await auth.getCurrentUser()).toEqual({ id: '1', email: 'a@iitk.ac.in' });
    expect(h.query.mock.calls[0][1]).toEqual([auth.sha256('tok')]);
  });

  it('getCurrentUser returns null for an unknown or expired session', async () => {
    h.jar.get.mockReturnValue({ value: 'tok' });
    h.query.mockResolvedValueOnce({ rows: [] });
    expect(await auth.getCurrentUser()).toBeNull();
  });

  it('destroySession deletes the stored session and the cookie', async () => {
    h.jar.get.mockReturnValue({ value: 'tok' });
    await auth.destroySession();
    expect(h.query.mock.calls[0][1]).toEqual([auth.sha256('tok')]);
    expect(h.jar.delete).toHaveBeenCalledWith('crp_session');
  });

  it('destroySession without a cookie only clears the cookie', async () => {
    h.jar.get.mockReturnValue(undefined);
    await auth.destroySession();
    expect(h.query).not.toHaveBeenCalled();
    expect(h.jar.delete).toHaveBeenCalledWith('crp_session');
  });
});

describe('sendMail', () => {
  const useScript = () => {
    vi.stubEnv('MAIL_SCRIPT_URL', 'https://script.test/exec');
    vi.stubEnv('MAIL_SCRIPT_SECRET', 'shh');
  };

  it('prints the mail to the console in development when unconfigured', async () => {
    vi.stubEnv('MAIL_SCRIPT_URL', undefined);
    vi.stubEnv('MAIL_SCRIPT_SECRET', undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await auth.sendMail('a@iitk.ac.in', 'Hi', 'Body');
    expect(log.mock.calls[0][0]).toContain('[dev mail] to=a@iitk.ac.in');
  });

  it('logs an error in production when unconfigured', async () => {
    const prod = await loadProd();
    vi.stubEnv('MAIL_SCRIPT_URL', undefined);
    vi.stubEnv('MAIL_SCRIPT_SECRET', undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await prod.sendMail('a@iitk.ac.in', 'Hi', 'Body');
    expect(err.mock.calls[0][0]).toContain('MAIL_SCRIPT_URL');
  });

  it('posts an escaped, linkified HTML body to the mail script', async () => {
    useScript();
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    await auth.sendMail('a@iitk.ac.in', 'Subj', 'a <b> & c https://x.test/z\nnext');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://script.test/exec');
    expect(init.method).toBe('POST');
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ secret: 'shh', to: 'a@iitk.ac.in', subject: 'Subj' });
    expect(sent.body).toContain('a &lt;b&gt; &amp; c');
    expect(sent.body).toContain('<a href="https://x.test/z">https://x.test/z</a>');
    expect(sent.body).toContain('<br>');
    expect(err).not.toHaveBeenCalled();
  });

  it('logs the script error when it reports failure', async () => {
    useScript();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, json: async () => ({ success: false, error: 'unauthorized' }) }),
    );
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await auth.sendMail('a@iitk.ac.in', 'S', 'B');
    expect(err).toHaveBeenCalledWith('Mail script error:', 'unauthorized');
  });

  it('logs the HTTP status when the response is not JSON', async () => {
    useScript();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 502, json: async () => Promise.reject(new Error('bad')) }),
    );
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await auth.sendMail('a@iitk.ac.in', 'S', 'B');
    expect(err).toHaveBeenCalledWith('Mail script error:', 502);
  });

  it('never throws when the network fails', async () => {
    useScript();
    const boom = new Error('offline');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(boom));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(auth.sendMail('a@iitk.ac.in', 'S', 'B')).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith('Email send failed', boom);
  });
});

describe('email flows', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'https://app.test/');
    vi.stubEnv('MAIL_SCRIPT_URL', undefined);
    vi.stubEnv('MAIL_SCRIPT_SECRET', undefined);
  });

  it('sendVerificationEmail issues a 24 h token and mails a verify link', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await auth.sendVerificationEmail('u1', 'a@iitk.ac.in');
    expect(h.query.mock.calls[1][1].slice(1)).toEqual(['u1', 'verify', 24 * 60]);
    expect(log.mock.calls[0][0]).toContain('https://app.test/api/auth/verify?token=');
  });

  it('sendResetEmail issues a 30 min token and mails a reset link', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await auth.sendResetEmail('u1', 'a@iitk.ac.in');
    expect(h.query.mock.calls[1][1].slice(1)).toEqual(['u1', 'reset', 30]);
    expect(log.mock.calls[0][0]).toContain('https://app.test/reset-password?token=');
  });
});
