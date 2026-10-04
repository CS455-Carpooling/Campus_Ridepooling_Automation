import { pool } from '@/lib/db';
import { appUrl, clientIp, consumeToken, rateLimit } from '@/lib/auth';

// Opened from an email link, so no origin check here; it is rate limited and the token is single-use.
export async function GET(req: Request) {
  const to = (n: string) => Response.redirect(`${appUrl()}/login?notice=${n}`, 303);
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!(await rateLimit(`verify:ip:${await clientIp()}`, 30, 3600))) return to('verify_failed');

  const userId = token.length > 20 ? await consumeToken(token, 'verify') : null;
  if (!userId) return to('verify_failed');
  await pool.query(
    'UPDATE users SET email_verified_at=now() WHERE id=$1 AND email_verified_at IS NULL',
    [userId],
  );
  return to('verified');
}
