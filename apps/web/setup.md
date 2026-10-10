# Campus Ride Pooling: Setup Guide

A carpool app for IIT Kanpur. Next.js (App Router) + PostgreSQL, with IITK-only authentication: only `@iitk.ac.in` emails can register, and every account must verify its email before logging in.

## What's included

| Feature | Details |
|---|---|
| Register | `@iitk.ac.in` only (checked in the browser, the API and a database constraint). Needs email verification. |
| Login / logout | Verified accounts only. Sessions last 1 day, or 30 days with "Keep me signed in". |
| Forgot / reset password | Single-use link valid for 30 minutes. Resetting signs the user out everywhere. |
| Security | scrypt password hashing, httpOnly session cookies (only a token hash is stored), CSRF origin check, database-backed rate limiting, no account enumeration, security headers and CSP. |
| Email | Sent through a small Google Apps Script web app (free, no domain needed). |

## Project layout

```
Campus_Ridepooling_Automation/
├── render.yaml                  # Render blueprint (web service + Postgres)
└── apps/web/                    # the Next.js app, and the project root for all commands below
    ├── package.json
    ├── next.config.ts           # security headers + CSP
    ├── .env.local               # YOUR secrets (never commit)
    ├── db/schema.sql            # database tables (idempotent)
    ├── scripts/migrate.mjs      # applies schema.sql
    └── src/
        ├── app/
        │   ├── login | register | forgot-password | reset-password | dashboard
        │   └── api/auth/        # register, login, logout, verify, forgot, reset
        ├── components/          # NextPage.tsx, PageShells.tsx (UI)
        ├── lib/                 # auth.ts (all auth logic), db.ts (Postgres pool)
        └── index.css
```

## 1. Prerequisites

- **Node.js 20 or newer** (`node -v`)
- **Docker Desktop** (for a local Postgres), or any Postgres 13+ you already have
- A **Gmail account** for sending emails through Apps Script (optional locally; see step 5)

## 2. Install

From the repository root:

```bash
npm install
```

If `pg` is missing from `apps/web/package.json`:

```bash
cd apps/web
npm i pg
npm i -D @types/pg
```

Make sure `apps/web/package.json` has this script:

```json
"db:migrate": "node scripts/migrate.mjs"
```

## 3. Start a local Postgres

```bash
docker run -d --name crp-pg -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=crp -p 5433:5432 postgres:16
```

- `pass` is just a local test password. You can choose another, but use the same value in `DATABASE_URL`.
- Port **5433** avoids clashing with any Postgres already installed on port 5432.
- Docker Desktop must be **running** first, or the command fails with "failed to connect to the docker API".
- Check it with `docker ps`; `crp-pg` should show `Up`.

## 4. Configure environment variables

Create `apps/web/.env.local` (it must sit next to `package.json`, not inside `src/`):

```env
DATABASE_URL=postgres://postgres:pass@localhost:5433/crp
APP_URL=http://localhost:3000

# Leave both empty for local development: emails are printed in the terminal instead.
MAIL_SCRIPT_URL=
MAIL_SCRIPT_SECRET=
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `APP_URL` | Public base URL, used in email links and redirects (no trailing slash). |
| `MAIL_SCRIPT_URL` | Your deployed Apps Script web app URL (step 5). |
| `MAIL_SCRIPT_SECRET` | Shared secret that must match the script's `MAIL_SECRET` property. |

Make sure `.env*` is listed in `.gitignore` and never commit real values.

## 5. Email setup (Google Apps Script)

Skip this for local testing. With the two mail variables empty, the verification and reset links are printed in the `npm run dev` terminal.

1. Go to <https://script.google.com> and create a **New project**.
2. Replace the contents with:

   ```javascript
   function doPost(e) {
     try {
       var data = JSON.parse(e.postData.contents);
       var secret = PropertiesService.getScriptProperties().getProperty("MAIL_SECRET");

       if (!secret || data.secret !== secret) return out({ success: false, error: "unauthorized" });
       // Even if the secret leaks, this can only email IITK addresses
       if (!/^[^@\s]+@iitk\.ac\.in$/i.test(String(data.to))) return out({ success: false, error: "recipient not allowed" });

       MailApp.sendEmail({
         to: data.to,
         subject: String(data.subject).slice(0, 200),
         htmlBody: data.body,
         name: "Campus Ride Pooling"
       });
       return out({ success: true });
     } catch (err) {
       return out({ success: false, error: "failed" });
     }
   }

   function out(obj) {
     return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
   }

   function authorize() { MailApp.getRemainingDailyQuota(); }
   ```

3. Generate a random secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```
4. **Project Settings → Script Properties → Add property**: name `MAIL_SECRET`, value = the secret from step 3.
5. Select the `authorize` function and click **Run**. Approve the permission prompt (one time).
6. **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Copy the **Web app URL**.
7. Put the URL in `MAIL_SCRIPT_URL` and the secret in `MAIL_SCRIPT_SECRET`.

Notes:
- After any later script edit, use **Deploy → Manage deployments → Edit → New version**, or the old code keeps running.
- A normal Gmail account can send roughly 100 emails per day. The first emails may land in spam.
- Emails do not appear in the Gmail **Sent** folder. Check the recipient's inbox or spam.
- Treat the script URL and secret like passwords. If either leaks, change `MAIL_SECRET` and redeploy.

## 6. Create the database tables

The migration script reads `DATABASE_URL` from the shell, not from `.env.local`. Set it first.

PowerShell:
```powershell
cd apps/web
$env:DATABASE_URL="postgres://postgres:pass@localhost:5433/crp"
npm run db:migrate
```

macOS / Linux:
```bash
cd apps/web
DATABASE_URL=postgres://postgres:pass@localhost:5433/crp npm run db:migrate
```

Expected output: `Database schema is up to date.` It is safe to run repeatedly.

## 7. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. Use `localhost`, not `127.0.0.1`, because the CSRF check compares the browser's Origin with the Host.

## 8. Test checklist

Keep the `npm run dev` terminal visible. In dev mode without mail variables, emails appear there as `[dev mail]`.

| Step | Expected |
|---|---|
| Register with a non-IITK email | Rejected |
| Register with `you@iitk.ac.in` | Success card; verification link printed or emailed |
| Log in before verifying | "Please verify your email first" |
| Open the verification link | Redirects to `/login` with "Email verified" |
| Log in | Lands on `/dashboard` |
| Open `/dashboard` in a private window | Redirected to `/login` |
| Log out | Back to `/login` |
| Forgot password, then open the reset link | Set a new password, log in with it |
| Reuse a verify or reset link | "Invalid or expired" |
| 11 wrong passwords in 15 minutes | "Too many attempts" |

## 9. Deploy to Render

1. Push the repository to GitHub.
2. In Render, create a **Blueprint** from the repo. It reads `render.yaml` at the repo root. For this monorepo, use these commands in the web service (run from the repo root, without `rootDir`):

   ```yaml
   databases:
     - name: crp-db
       databaseName: crp
       plan: free

   services:
     - type: web
       name: campus-ride-pooling
       runtime: node
       plan: free
       buildCommand: npm ci && npm run build -w @ridepool/web
       startCommand: npm run db:migrate -w @ridepool/web && npm start -w @ridepool/web
       healthCheckPath: /
       envVars:
         - key: NODE_VERSION
           value: 20
         - key: DATABASE_URL
           fromDatabase:
             name: crp-db
             property: connectionString
         - key: APP_URL
           sync: false
         - key: MAIL_SCRIPT_URL
           sync: false
         - key: MAIL_SCRIPT_SECRET
           sync: false
   ```

   `@ridepool/web` is the workspace name in `apps/web/package.json`; change it if yours differs.
3. After the first deploy, set `APP_URL` (for example `https://campus-ride-pooling.onrender.com`), `MAIL_SCRIPT_URL` and `MAIL_SCRIPT_SECRET` in the service's **Environment** tab, then redeploy.
4. The schema is applied automatically at every start (`db:migrate`).
5. `DATABASE_URL` is the Render **internal** URL, which needs no extra setup. To connect from your own machine, use the **External** URL; the code enables TLS for it automatically.

Notes:
- Render's **free Postgres expires after about 30 days**. Use a paid plan for real data.
- Free web services sleep when idle, so the first request after a pause is slow.
- Before opening the app to real users, remove your test data (see below).

## 10. Database cheat sheet

Local Docker database:

```bash
# list users
docker exec -it crp-pg psql -U postgres crp -c "SELECT email, full_name, email_verified_at FROM users;"

# delete everything (keeps the tables)
docker exec -it crp-pg psql -U postgres crp -c "TRUNCATE users, sessions, auth_tokens, rate_limits CASCADE;"

# clear rate limits only (after "Too many attempts")
docker exec -it crp-pg psql -U postgres crp -c "DELETE FROM rate_limits;"

# log everyone out
docker exec -it crp-pg psql -U postgres crp -c "DELETE FROM sessions;"

# drop and recreate the tables
docker exec -it crp-pg psql -U postgres crp -c "DROP TABLE IF EXISTS sessions, auth_tokens, rate_limits, users CASCADE;"
npm run db:migrate
```

On Render, run the same SQL through `psql` with the External URL, or the database's **Shell** tab.

### Trying ratings locally

Joining a ride is not built yet, so put people on a ride by hand to try the review page. With the
Docker Compose stack from the root README, after registering the accounts and offering a ride:

```bash
# put another account on the ride, with a pickup point
docker compose exec db psql -U crp -d crp -c "INSERT INTO riders (ride_id, user_id, campus_location_id) SELECT '<ride id>', id, 'hall-5' FROM users WHERE email = '<name>@iitk.ac.in';"

# move the ride into the past, so its owner can mark it completed on the ride page
docker compose exec db psql -U crp -d crp -c "UPDATE rides SET departure_start = now() - interval '2 hours', departure_end = now() - interval '1 hour' WHERE id = '<ride id>';"

# after rating: end the 72 hours early, so averages and comments appear (from 3 ratings)
docker compose exec db psql -U crp -d crp -c "UPDATE rides SET completed_at = now() - interval '73 hours' WHERE id = '<ride id>';"
```

### Making an operations admin

Admins are ordinary accounts with the admin role. Register and verify the account in the app
first, then run this where `DATABASE_URL` points at the database (it fails for an unknown or
unverified address):

```bash
# from apps/web, against your own database
npm run admin:grant -- name@iitk.ac.in
npm run admin:revoke -- name@iitk.ac.in

# with the Docker Compose stack
docker compose exec web node apps/web/scripts/admin-role.mjs grant name@iitk.ac.in
```

Give each admin their own account rather than sharing one, so the audit log shows who did what
(SYS-NFR-08). Accounts with audit records cannot be deleted.

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `failed to connect to the docker API` | Start Docker Desktop and wait for "Engine running". |
| `Unable to find image 'postgres:16' locally` and it hangs | It's still downloading. If it never finishes, try `docker pull postgres:16`, a different network, or Docker's DNS settings. |
| `password authentication failed for user "postgres"` | Another Postgres is probably answering on 5432. Use port 5433 as in step 3, and check `echo $env:DATABASE_URL`. |
| `relation "users" does not exist` | Run `npm run db:migrate` (step 6). |
| `Cannot find module '@/lib/auth'` | `src/lib/auth.ts` and `db.ts` are missing, or `tsconfig.json` lacks `"paths": { "@/*": ["./src/*"] }`. |
| `Cannot find module 'pg'` | Run `npm i pg` in `apps/web`. |
| 500 on register | Read the red error in the `npm run dev` terminal. It is almost always the database connection or missing tables. |
| 403 "Invalid request origin" | Open the app at exactly `http://localhost:3000`. |
| Emails only print in the terminal | `MAIL_SCRIPT_URL` or `MAIL_SCRIPT_SECRET` isn't loaded. `.env.local` must be in `apps/web` (not `src/`), and the dev server must be restarted after editing it. |
| Mail script error `unauthorized` | The secret in `.env.local` doesn't match the `MAIL_SECRET` script property. |
| Edited the Apps Script but nothing changed | Deploy a **New version** of the web app. |
| "Too many attempts" while testing | Clear `rate_limits` (step 10). |
| Console warning about `scroll-behavior: smooth` | Harmless. Add `data-scroll-behavior="smooth"` to `<html>` in `layout.tsx` to silence it. |

## 12. Security notes for contributors

- Never commit `.env`, `.env.local`, the Apps Script URL or its secret.
- All auth logic lives in `src/lib/auth.ts`. New API routes that change state should call `guard(...)` (origin check and rate limit).
- Don't reveal whether an email is registered in any response or error message.
- Session, verification and reset tokens are random and stored only as SHA-256 hashes.
- If you change the password rules, update both the form in `PageShells.tsx` and the checks in the `register` and `reset` routes.