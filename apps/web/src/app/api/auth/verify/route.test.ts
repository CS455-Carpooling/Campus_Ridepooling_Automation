// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  query: vi.fn(),
  rateLimit: vi.fn(),
  consumeToken: vi.fn(),
  clientIp: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: m.query } }));
vi.mock('@/lib/auth', () => ({
  appUrl: () => 'http://localhost:3000',
  rateLimit: m.rateLimit,
  consumeToken: m.consumeToken,
  clientIp: m.clientIp,
}));

import { GET } from './route';

const LONG = 'a'.repeat(32);
const get = (qs: string) => GET(new Request(`http://localhost/api/auth/verify${qs}`));
const location = (res: Response) => res.headers.get('location');

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.clientIp.mockResolvedValue('1.2.3.4');
  m.rateLimit.mockResolvedValue(true);
});

describe('GET /api/auth/verify', () => {
  it('redirects to a failure notice when rate limited', async () => {
    m.rateLimit.mockResolvedValue(false);
    const res = await get(`?token=${LONG}`);
    expect(res.status).toBe(303);
    expect(location(res)).toBe('http://localhost:3000/login?notice=verify_failed');
    expect(m.rateLimit).toHaveBeenCalledWith('verify:ip:1.2.3.4', 30, 3600);
  });

  it.each([
    ['', 'no token'],
    ['?token=short', 'a short token'],
  ])('fails for %s', async (qs) => {
    const res = await get(qs);
    expect(location(res)).toMatch(/verify_failed$/);
    expect(m.consumeToken).not.toHaveBeenCalled();
  });

  it('fails for an unknown or expired token', async () => {
    m.consumeToken.mockResolvedValue(null);
    expect(location(await get(`?token=${LONG}`))).toMatch(/verify_failed$/);
    expect(m.query).not.toHaveBeenCalled();
  });

  it('marks the email verified and redirects with a success notice', async () => {
    m.consumeToken.mockResolvedValue('u1');
    m.query.mockResolvedValue({ rows: [] });
    const res = await get(`?token=${LONG}`);
    expect(m.consumeToken).toHaveBeenCalledWith(LONG, 'verify');
    expect(m.query.mock.calls[0][1]).toEqual(['u1']);
    expect(location(res)).toBe('http://localhost:3000/login?notice=verified');
  });
});
