import { pool } from '@/lib/db';
import {
  EMAIL_RE,
  normalizeEmail,
  guard,
  rateLimit,
  readJson,
  json,
  sendResetEmail,
} from '@/lib/auth';

export async function POST(req: Request) {
  const blocked = await guard('forgot', 10, 3600);
  if (blocked) return blocked;

  const email = normalizeEmail((await readJson(req)).email);
  if (EMAIL_RE.test(email) && (await rateLimit(`forgot:${email}`, 3, 3600))) {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email=$1 AND email_verified_at IS NOT NULL',
      [email],
    );
    if (rows[0]) await sendResetEmail(rows[0].id, email);
  }
  return json({ ok: true }); // same response whether or not the account exists
}
