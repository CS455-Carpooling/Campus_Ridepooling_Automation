import crypto from 'node:crypto';

/**
 * Test accounts and sessions written straight to the database, for the integration tests and
 * the Playwright system tests. Registering through the app sends a real verification email,
 * so tests never do that. Plain SQL with no app imports: pass any client with a `query`
 * method (a pg Pool or Client).
 */
export type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export type TestAccount = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
};

let counter = 0;

/**
 * A verified account that has finished first sign-in setup: getCurrentUser() only accepts a
 * student whose profile has a campus pickup point.
 */
export async function createAccount(
  db: Queryable,
  options: {
    role?: 'student' | 'admin';
    name?: string;
    campusPlace?: string;
    mobile?: string | null;
  } = {},
): Promise<TestAccount> {
  counter += 1;
  const role = options.role ?? 'student';
  const name = options.name ?? `Test ${role === 'admin' ? 'Admin' : 'Student'} ${counter}`;
  const email = `test.${role}.${counter}.${crypto.randomBytes(3).toString('hex')}@iitk.ac.in`;
  const { rows } = await db.query(
    `INSERT INTO users (email, full_name, roll_number, password_hash, email_verified_at, role)
     VALUES ($1, $2, $3, 'scrypt$not-for-sign-in$not-for-sign-in', now(), $4)
     RETURNING id`,
    [email, name, `T${String(counter).padStart(6, '0')}`, role],
  );
  const id = rows[0].id as string;
  await db.query(
    `INSERT INTO user_profiles (user_id, display_name, default_pickup_point_id, mobile_number)
     VALUES ($1, $2, $3, $4)`,
    [id, name, options.campusPlace ?? 'hall-1', options.mobile ?? null],
  );
  return { id, email, name, role };
}

/**
 * A signed-in session for `userId`. Only the token's SHA-256 is stored, as the app does; the
 * raw token returned here goes in the session cookie (crp_session under `next dev` and in the
 * tests, __Host-crp_session in a production build such as the Docker stack).
 */
export async function createSessionToken(
  db: Queryable,
  userId: string,
  options: { ttlSeconds?: number } = {},
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [crypto.createHash('sha256').update(token).digest('hex'), userId, options.ttlSeconds ?? 86_400],
  );
  return token;
}
