import { pool } from '@/lib/db';
import {
  EMAIL_RE,
  normalizeEmail,
  hashPassword,
  guard,
  rateLimit,
  readJson,
  json,
  sendVerificationEmail,
  sendMail,
  appUrl,
} from '@/lib/auth';

export async function POST(req: Request) {
  const blocked = await guard('register', 10, 3600);
  if (blocked) return blocked;

  const b = await readJson(req);
  const email = normalizeEmail(b.email);
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
  const roll = typeof b.roll === 'string' ? b.roll.trim().toUpperCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';

  if (!EMAIL_RE.test(email))
    return json({ error: 'Please use your @iitk.ac.in email address.' }, 400);
  if (name.length < 2 || name.length > 80)
    return json({ error: 'Please enter your full name.' }, 400);
  if (!/^[A-Z0-9]{4,12}$/.test(roll))
    return json({ error: 'Please enter a valid roll number.' }, 400);
  if (password.length < 8 || password.length > 128)
    return json({ error: 'Password must be 8 to 128 characters.' }, 400);
  if (b.terms !== true)
    return json({ error: 'Please accept the guidelines and privacy policy.' }, 400);
  if (!(await rateLimit(`register:${email}`, 3, 3600)))
    return json({ error: 'Too many attempts. Please try again later.' }, 429);

  const hash = await hashPassword(password); // always computed, so timing doesn't reveal existing accounts
  const ins = await pool.query(
    `INSERT INTO users (email,full_name,roll_number,password_hash) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [email, name, roll, hash],
  );

  if (ins.rows[0]) {
    await sendVerificationEmail(ins.rows[0].id, email);
  } else {
    const { rows } = await pool.query('SELECT id,email_verified_at FROM users WHERE email=$1', [
      email,
    ]);
    const u = rows[0];
    if (u && !u.email_verified_at)
      await sendVerificationEmail(u.id, email); // resend; never overwrite the password
    else if (u)
      void sendMail(
        email,
        'You already have an account',
        `Someone tried to register this email on Campus Ride Pooling. If it was you, log in or reset your password:\n${appUrl()}/forgot-password`,
      );
  }
  // Identical response in every case, so the form can't be used to discover registered emails.
  return json({ ok: true });
}
