// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  query: vi.fn(),
  guard: vi.fn(),
  rateLimit: vi.fn(),
  sendResetEmail: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: m.query } }));
vi.mock('@/lib/auth', () => ({
  EMAIL_RE: /^[a-z0-9._%+-]+@iitk\.ac\.in$/,
  normalizeEmail: (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  readJson: async (req: Request) => req.json(),
  json: (body: object, status = 200) => Response.json(body, { status }),
  guard: m.guard,
  rateLimit: m.rateLimit,
  sendResetEmail: m.sendResetEmail,
}));

import { POST } from './route';

const post = (body: Record<string, unknown>) =>
  POST(
    new Request('http://localhost/api/auth/forgot', { method: 'POST', body: JSON.stringify(body) }),
  );

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.guard.mockResolvedValue(null);
  m.rateLimit.mockResolvedValue(true);
});

describe('POST /api/auth/forgot', () => {
  it('returns the guard response when blocked', async () => {
    m.guard.mockResolvedValue(new Response('no', { status: 429 }));
    expect((await post({ email: 'a@iitk.ac.in' })).status).toBe(429);
  });

  it('answers ok without a lookup for a non-IITK email', async () => {
    const res = await post({ email: 'a@gmail.com' });
    expect(await res.json()).toEqual({ ok: true });
    expect(m.query).not.toHaveBeenCalled();
  });

  it('answers ok without a lookup when the per-email limit is hit', async () => {
    m.rateLimit.mockResolvedValue(false);
    expect((await post({ email: 'a@iitk.ac.in' })).status).toBe(200);
    expect(m.rateLimit).toHaveBeenCalledWith('forgot:a@iitk.ac.in', 3, 3600);
    expect(m.query).not.toHaveBeenCalled();
  });

  it('sends a reset email for a verified account', async () => {
    m.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
    expect(await (await post({ email: 'A@iitk.ac.in' })).json()).toEqual({ ok: true });
    expect(m.sendResetEmail).toHaveBeenCalledWith('u1', 'a@iitk.ac.in');
  });

  it('gives the same answer but sends nothing for an unknown account', async () => {
    m.query.mockResolvedValue({ rows: [] });
    expect(await (await post({ email: 'a@iitk.ac.in' })).json()).toEqual({ ok: true });
    expect(m.sendResetEmail).not.toHaveBeenCalled();
  });
});
