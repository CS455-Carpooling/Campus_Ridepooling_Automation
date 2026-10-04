// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ sameOrigin: vi.fn(), destroySession: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  appUrl: () => 'http://localhost:3000',
  json: (body: object, status = 200) => Response.json(body, { status }),
  sameOrigin: m.sameOrigin,
  destroySession: m.destroySession,
}));

import { POST } from './route';

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe('POST /api/auth/logout', () => {
  it('rejects a foreign origin without touching the session', async () => {
    m.sameOrigin.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(m.destroySession).not.toHaveBeenCalled();
  });

  it('destroys the session and redirects to /login', async () => {
    m.sameOrigin.mockResolvedValue(true);
    const res = await POST();
    expect(m.destroySession).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });
});
