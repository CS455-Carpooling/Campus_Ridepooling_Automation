// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  getCurrentUser: vi.fn(),
  guard: vi.fn(),
  hashPassword: vi.fn(),
  newToken: vi.fn(),
  destroySession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { connect: m.connect } }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: m.getCurrentUser,
  guard: m.guard,
  hashPassword: m.hashPassword,
  newToken: m.newToken,
  destroySession: m.destroySession,
  json: (body: object, status = 200) => Response.json(body, { status }),
}));

import { POST } from './route';

const post = (confirmation: unknown) =>
  POST(
    new Request('http://localhost/api/profile/delete', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    }),
  );

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'rider@iitk.ac.in' });
  m.guard.mockResolvedValue(null);
  m.hashPassword.mockResolvedValue('replacement-hash');
  m.newToken.mockReturnValue('unusable-random-password');
  m.clientQuery.mockResolvedValue({ rows: [] });
  m.connect.mockResolvedValue({ query: m.clientQuery, release: m.release });
});

describe('POST /api/profile/delete', () => {
  it('requires authentication and explicit confirmation', async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect((await post('DELETE')).status).toBe(401);

    m.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'rider@iitk.ac.in' });
    expect((await post('yes')).status).toBe(400);
    expect(m.connect).not.toHaveBeenCalled();
  });

  it('anonymizes account details, clears auth/profile data, and signs out', async () => {
    const response = await post('DELETE');
    expect(await response.json()).toEqual({ ok: true });
    expect(m.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("full_name = 'Deleted user'"),
      ['deleted+u1@iitk.ac.in', 'replacement-hash', 'u1'],
    );
    expect(m.clientQuery).toHaveBeenCalledWith('DELETE FROM sessions WHERE user_id = $1', ['u1']);
    expect(m.clientQuery).toHaveBeenCalledWith('DELETE FROM auth_tokens WHERE user_id = $1', [
      'u1',
    ]);
    expect(m.clientQuery).toHaveBeenCalledWith('DELETE FROM user_profiles WHERE user_id = $1', [
      'u1',
    ]);
    expect(m.clientQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(m.destroySession).toHaveBeenCalledOnce();
    expect(m.release).toHaveBeenCalledOnce();
  });

  it('does not treat an elapsed scheduled window as an active ride', async () => {
    m.clientQuery.mockImplementation(async (sql: string) =>
      sql.includes('AS busy') ? { rows: [{ busy: false }] } : { rows: [] },
    );

    const response = await post('DELETE');
    expect(response.status).toBe(200);
    const check = m.clientQuery.mock.calls.find(([sql]) => String(sql).includes('AS busy'));
    expect(check?.[0]).toContain("r.state = 'scheduled' AND r.departure_end > now()");
  });

  it('keeps an account that has an upcoming ride or a waiting request (FR-RD-16.3)', async () => {
    m.clientQuery.mockImplementation(async (sql: string) =>
      sql.includes('AS busy') ? { rows: [{ busy: true }] } : { rows: [] },
    );
    const response = await post('DELETE');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        'Cancel or leave your upcoming rides and withdraw your waiting requests before deleting your account.',
      code: 'active_rides',
    });
    const check = m.clientQuery.mock.calls.find(([sql]) => String(sql).includes('AS busy'));
    expect(check?.[0]).toContain('seat.left_at IS NULL AND seat.no_show_at IS NULL');
    expect(check?.[0]).toContain("r.state = 'scheduled' AND r.departure_end > now()");
    expect(check?.[0]).toContain("request.status IN ('pending', 'needs_reconfirmation')");
    expect(check?.[1]).toEqual(['u1']);
    expect(m.clientQuery.mock.calls[1]).toEqual([
      'SELECT 1 FROM users WHERE id = $1 FOR UPDATE',
      ['u1'],
    ]);
    expect(m.clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(m.clientQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE users'))).toBe(
      false,
    );
    expect(m.destroySession).not.toHaveBeenCalled();
    // The slow password hash is not paid for a refused attempt.
    expect(m.hashPassword).not.toHaveBeenCalled();
  });
});
