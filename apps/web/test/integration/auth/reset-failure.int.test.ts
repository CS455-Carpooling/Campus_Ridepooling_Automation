import { describe, expect, it, vi } from 'vitest';
import { POST as resetPassword } from '@/app/api/auth/reset/route';
import { pool } from '@/lib/db';
import { issueToken, sha256 } from '@/lib/auth';
import { callRoute } from '../http';
import { signedInStudent } from '../fixtures';

describe('password reset database failure recovery', () => {
  it('rolls back token consumption when the password update fails', async () => {
    const user = await signedInStudent();
    const token = await issueToken(user.id, 'reset', 60);
    const { rows: before } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id],
    );

    await pool.query(`
      CREATE FUNCTION fail_test_password_reset_update() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'injected password reset update failure';
      END;
      $$
    `);
    await pool.query(`
      CREATE TRIGGER fail_test_password_reset_update
      BEFORE UPDATE OF password_hash ON users
      FOR EACH ROW EXECUTE FUNCTION fail_test_password_reset_update()
    `);

    try {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await callRoute(resetPassword, {
        method: 'POST',
        path: '/api/auth/reset',
        body: { token, password: 'a-new-valid-password' },
      });
      errorLog.mockRestore();

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Unable to reset the password right now.');

      const { rows: remainingToken } = await pool.query(
        'SELECT id FROM auth_tokens WHERE token_hash = $1 AND purpose = $2',
        [sha256(token), 'reset'],
      );
      const { rows: after } = await pool.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [user.id],
      );
      const { rows: sessions } = await pool.query(
        'SELECT id FROM sessions WHERE user_id = $1',
        [user.id],
      );

      expect(remainingToken).toHaveLength(1);
      expect(after[0]?.password_hash).toBe(before[0]?.password_hash);
      expect(sessions).toHaveLength(1);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS fail_test_password_reset_update ON users');
      await pool.query('DROP FUNCTION IF EXISTS fail_test_password_reset_update()');
    }
  });
});
