import { pool } from '@/lib/db';
import {
  normalizeEmail,
  verifyPassword,
  fakeVerify,
  guard,
  rateLimit,
  readJson,
  json,
  createSession,
  cleanup,
} from '@/lib/auth';

export async function POST(req: Request) {
  const blocked = await guard('login', 30, 900);
  if (blocked) return blocked;

  const b = await readJson(req);
  const email = normalizeEmail(b.email);
  const password = typeof b.password === 'string' ? b.password.slice(0, 128) : '';
  if (!email || !password) return json({ error: 'Invalid email or password.' }, 401);

  // Per-email limit also applies to non-existent emails, so lockout reveals nothing.
  if (!(await rateLimit(`login:${email}`, 10, 900)))
    return json({ error: 'Too many attempts. Please try again later.' }, 429);

  const { rows } = await pool.query(
    'SELECT id,password_hash,email_verified_at FROM users WHERE email=$1',
    [email],
  );
  const user = rows[0];

  if (!user) {
    await fakeVerify(password);
    return json({ error: 'Invalid email or password.' }, 401);
  }
  if (!(await verifyPassword(password, user.password_hash)))
    return json({ error: 'Invalid email or password.' }, 401);
  if (!user.email_verified_at)
    return json(
      {
        error:
          'Please verify your email first. Check your inbox, or register again with the same email to get a new link.',
      },
      403,
    );

  await createSession(user.id, b.remember === true); // fresh token every login
  if (Math.random() < 0.02) void cleanup().catch(() => {});
  return json({ ok: true });
}
