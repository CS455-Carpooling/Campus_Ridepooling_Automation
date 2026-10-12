// Makes an existing account an operations admin, or a student again (SYS-FR-39 to 41).
// The app itself never changes a role, so this script, run by whoever operates the database,
// is the only way. Each change is written to admin_audit_log as an operator action.
//
//   npm run admin:grant -- name@iitk.ac.in
//   npm run admin:revoke -- name@iitk.ac.in
import pg from 'pg';

const [command, rawEmail] = process.argv.slice(2);
const roles = { grant: 'admin', revoke: 'student' };
const role = roles[command];
const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

if (!role || !/^[a-z0-9._%+-]+@iitk\.ac\.in$/.test(email)) {
  console.error('Usage: node scripts/admin-role.mjs grant|revoke name@iitk.ac.in');
  process.exit(2);
}

const rawUrl = process.env.DATABASE_URL;
const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
if (!/^postgres(?:ql)?:\/\//i.test(url)) {
  console.error('DATABASE_URL is not set or is not a valid Postgres connection string');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('.render.com') ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

let exitCode = 0;
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    'SELECT id, role, email_verified_at FROM users WHERE email = $1 FOR UPDATE',
    [email],
  );
  const user = rows[0];
  if (!user) {
    console.error(`No account uses ${email}. Register it in the app first.`);
    exitCode = 1;
  } else if (role === 'admin' && !user.email_verified_at) {
    console.error(`${email} has not verified its email address yet, so it cannot be an admin.`);
    exitCode = 1;
  } else if (user.role === role) {
    console.log(`${email} is already ${role === 'admin' ? 'an operations admin' : 'a student'}.`);
  } else {
    await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);
    await client.query(
      `INSERT INTO admin_audit_log
         (actor_type, action, entity_type, entity_id, before_state, after_state, outcome)
       VALUES ('operator_script', $1, 'user', $2, $3, $4, 'succeeded')`,
      [`role.${command}`, user.id, { role: user.role }, { role }],
    );
    console.log(
      role === 'admin' ? `${email} is now an operations admin.` : `${email} is a student again.`,
    );
  }
  await client.query(exitCode === 0 ? 'COMMIT' : 'ROLLBACK');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error('Changing the role failed:', error.message);
  exitCode = 1;
} finally {
  await client.end();
}
process.exit(exitCode);
