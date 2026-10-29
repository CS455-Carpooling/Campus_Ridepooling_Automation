# Campus Ride Pooling: Setup Guide

A carpool app for IIT Kanpur. Next.js (App Router) + PostgreSQL, with IITK-only authentication: only `@iitk.ac.in` emails can register, and every account must verify its email before logging in.

## What's included

| Feature | Details |
|---|---|
| Authentication | `@iitk.ac.in` registration with email verification, sign-in/out, forgot/reset password and server-managed sessions. |
| Rides | Students can offer rides and search for rides using the same account; owners review and decide seat requests. |
| Ride coordination | Ride chat, notifications, pickup/trip progress, no-show handling and SOS workflows. |
| Fare and settlement | Equal whole-ride fare shares are calculated by the server. The app records external settlement; it does not transfer money. |
| AI assistance | Gemini-backed ride recommendations, natural-language chatbot and advisory complaint analysis; validated deterministic fallback/manual review paths remain available. |
| Administration | Audited configuration changes, complaint review, rider warnings/suspensions and SOS incident management. |
| Security | scrypt password hashing, httpOnly session cookies (only a token hash is stored), CSRF origin checks, database-backed rate limiting, no account enumeration, security headers and CSP. |
| Email | Optional verification and reset email delivery through a Google Apps Script web app. |

## Project layout

```
Campus_Ridepooling_Automation/
├── docker-compose.yml           # local PostgreSQL and production web app
├── Deliverables/                # course deliverables and D2 records
└── apps/web/                    # Next.js workspace; app commands can also run from the repo root
    ├── package.json
    ├── server.mjs                # Next.js and Socket.IO HTTP server
    ├── next.config.ts           # security headers and CSP
    ├── .env.local               # local secrets (never commit)
    ├── db/schema.sql            # database tables (idempotent)
    ├── scripts/                 # schema migration and admin-role tools
    └── src/
        ├── app/                 # public, authenticated, admin and API routes
        ├── components/          # shared UI and feature components
        └── lib/                 # authentication, domain rules, database and AI integrations
```

## 1. Prerequisites

- **Node.js 24** (`node -v`; this matches `.nvmrc` and the production Docker image)
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

# Optional: server-side Gemini key for recommendations, the chatbot, and admin complaint analysis.
GEMINI_API_KEY=
# Shared Gemini model; the chatbot may be overridden with GEMINI_CHATBOT_MODEL.
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_CHATBOT_MODEL=

# Required only when scheduling the post-ride payment reminder endpoint.
PAYMENT_REMINDER_CRON_SECRET=
```

For Docker Compose, put `GEMINI_API_KEY` and `GEMINI_MODEL` in the repository-root `.env` beside
`docker-compose.yml` (copy the root `.env.example` first). Compose forwards those two settings to
the web service; it does not read `apps/web/.env` or `apps/web/.env.local`. If using the optional
`GEMINI_CHATBOT_MODEL` override or `PAYMENT_REMINDER_CRON_SECRET` with Compose, configure that
variable explicitly in the web service environment because the current Compose file does not
forward it.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `APP_URL` | Public base URL, used in email links and redirects (no trailing slash). |
| `MAIL_SCRIPT_URL` | Your deployed Apps Script web app URL (step 5). |
| `MAIL_SCRIPT_SECRET` | Shared secret that must match the script's `MAIL_SECRET` property. |
| `GEMINI_API_KEY` | Optional server-only Gemini key for recommendations, the chatbot and complaint analysis. Never expose it with a `NEXT_PUBLIC_` variable. |
| `GEMINI_MODEL` | Shared Gemini model ID. The example uses `gemini-3.1-flash-lite`. |
| `GEMINI_CHATBOT_MODEL` | Optional chatbot-only model override; defaults to `GEMINI_MODEL`. |
| `PAYMENT_REMINDER_CRON_SECRET` | Secret for the scheduled `POST /api/cron/payment-reminders` endpoint. Keep it in the deployment secret manager and configure the scheduler to send it in the `Authorization` header. |

Make sure `.env*` is listed in `.gitignore` and never commit real values.
Complaint analysis is advisory; a missing key, timeout, invalid output, or confidence below 65% routes the complaint to manual admin review without affecting the complaint itself.
After filing a complaint, the server sends its description and up to five earlier complaint descriptions about the same rider to Google's Gemini API for analysis. Before sending, it redacts email addresses and contiguous 10-digit numbers from those descriptions. Do not include other sensitive information in complaint text; redaction cannot identify every possible personal detail. The source complaint remains unchanged in the application.

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

The migration script first uses `DATABASE_URL` from the shell. If it is unset, the script also
checks `.env.local` and `.env` in `apps/web` and the repository root.

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

### Integration tests

`npm run test:integration` (from `apps/web`) calls the real API route handlers against a real
PostgreSQL database: sessions, origin checks, rate limits, SQL constraints and triggers all run
as in the app. Only `cookies()` and `headers()` from `next/headers` are replaced, by
`test/integration/next-headers.ts`, because Next.js answers them only inside its own requests.

1. Start the Compose database: `docker compose up -d db` (from the repository root).
2. Add two lines to `apps/web/.env.local`, with the `POSTGRES_PASSWORD` from the root `.env`:

   ```env
   TEST_DATABASE_URL=postgres://crp:<password>@127.0.0.1:5433/crp_test
   ALLOW_TEST_DATABASE_RESET=crp_test
   ```

3. Run `npm run test:integration`.

Every run drops `crp_test`, creates it again and applies `db/schema.sql`; every test then starts
from that freshly migrated state. Because that is destructive, the tests fail closed and touch
the database only when all of these hold (`test/integration/test-database.ts`):

- its name ends in `_test`, so your `crp` data is never a candidate;
- it is on this machine (`localhost`, `127.0.0.1` or `::1`), never a hosted server;
- `ALLOW_TEST_DATABASE_RESET` names exactly that database, as an explicit opt-in;
- it was created by the tests themselves: they mark the database they create, and refuse to drop
  or empty an existing one without that mark. If an older `crp_test` is refused, drop it once
  with `docker compose exec db dropdb -U crp crp_test`.

Test accounts and sessions are inserted with
SQL (`test/seed/accounts.ts`), so no email is sent; Gemini and mail are switched off. CI runs
the same tests in the "Integration tests (PostgreSQL)" job.

## 9. Deploy to Render

There is no `render.yaml` in this repository, so create the PostgreSQL database and web service
through the Render dashboard rather than creating a Blueprint.

1. Push the repository to GitHub and create a PostgreSQL database in Render.
2. Create a web service for the repository, using the repository root as its root directory and
   Node.js 24. Configure:

   ```text
   Build command: npm ci && npm run build --workspace @ridepool/web
   Start command: npm run db:migrate --workspace @ridepool/web && npm run start --workspace @ridepool/web
   Health check path: /api/health
   ```

3. Set `DATABASE_URL` to the database's internal connection string. Set `APP_URL` to the public
   HTTPS origin of the web service. Configure `MAIL_SCRIPT_URL`, `MAIL_SCRIPT_SECRET`, and
   `GEMINI_API_KEY` when those integrations are enabled.
4. If post-ride payment reminders are used, also set a private `PAYMENT_REMINDER_CRON_SECRET` and
   configure an external scheduler to call `POST /api/cron/payment-reminders`; see the environment
   variable notes above.
5. The start command applies `db/schema.sql` before starting the app. For local database access,
   use the provider's external connection string; PostgreSQL connections to Render are configured
   for TLS by the database helper.

Review the hosting provider's current service and database limits before using the deployment with
real users. Remove test data before opening it to users.

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

# move the ride into its lock window, so its owner can start pickup and then complete it on the
# ride page (a ride is completed only once its trip has started)
docker compose exec db psql -U crp -d crp -c "UPDATE rides SET departure_start = now() + interval '30 minutes', departure_end = now() + interval '90 minutes' WHERE id = '<ride id>';"

# after rating: end the 72 hours early, so averages and comments appear (from 3 ratings)
docker compose exec db psql -U crp -d crp -c "UPDATE rides SET completed_at = now() - interval '73 hours' WHERE id = '<ride id>';"
```

### Trying a trip locally

A trip can start only once its ride is locked, an hour before departure. To try pickup, arrivals,
no-shows and SOS without waiting, move a ride you offered into its lock window, after putting
people on it as above:

```bash
# departure in 30 minutes: locked, so its owner can start pickup on the ride page
docker compose exec db psql -U crp -d crp -c "UPDATE rides SET departure_start = now() + interval '30 minutes', departure_end = now() + interval '90 minutes' WHERE id = '<ride id>';"

# departure 20 minutes ago: the 5-minute no-show grace period is already over
docker compose exec db psql -U crp -d crp -c "UPDATE rides SET departure_start = now() - interval '20 minutes', departure_end = now() + interval '40 minutes' WHERE id = '<ride id>';"
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