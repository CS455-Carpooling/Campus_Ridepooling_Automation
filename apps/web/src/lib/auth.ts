import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { pool } from "./db";

/* ---------- config & validation ---------- */
const isProd = process.env.NODE_ENV === "production";
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const EMAIL_RE = /^[a-z0-9._%+-]+@iitk\.ac\.in$/;
export const normalizeEmail = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase().slice(0, 254) : "";

export const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* ---------- passwords (scrypt, per-user salt) ---------- */
const scrypt = promisify(crypto.scrypt) as (
  pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions
) => Promise<Buffer>;
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [, s, k] = stored.split("$");
  const expected = Buffer.from(k, "base64");
  const key = await scrypt(pw, Buffer.from(s, "base64"), expected.length, SCRYPT);
  return crypto.timingSafeEqual(key, expected);
}

let dummy: Promise<string> | null = null;
/** Burns the same CPU time when the email doesn't exist (prevents timing-based enumeration). */
export async function fakeVerify(pw: string) {
  dummy ??= hashPassword("not-a-real-password");
  await verifyPassword(pw, await dummy).catch(() => false);
}

/* ---------- tokens ---------- */
export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export async function issueToken(userId: string, purpose: "verify" | "reset", ttlMinutes: number) {
  const raw = newToken();
  await pool.query("DELETE FROM auth_tokens WHERE user_id=$1 AND purpose=$2", [userId, purpose]);
  await pool.query(
    "INSERT INTO auth_tokens (token_hash,user_id,purpose,expires_at) VALUES ($1,$2,$3,now()+make_interval(mins=>$4))",
    [sha256(raw), userId, purpose, ttlMinutes]
  );
  return raw;
}

/** Atomic and single-use: the token is deleted as it is read. */
export async function consumeToken(raw: string, purpose: "verify" | "reset"): Promise<string | null> {
  const { rows } = await pool.query(
    "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id",
    [sha256(raw), purpose]
  );
  return rows[0]?.user_id ?? null;
}

/* ---------- abuse protection ---------- */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const { rows } = await pool.query(
    `INSERT INTO rate_limits AS r (key,count,reset_at) VALUES ($1,1,now()+make_interval(secs=>$2))
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN r.reset_at < now() THEN 1 ELSE r.count+1 END,
       reset_at = CASE WHEN r.reset_at < now() THEN now()+make_interval(secs=>$2) ELSE r.reset_at END
     RETURNING count`,
    [key.slice(0, 300), windowSec]
  );
  return rows[0].count <= limit;
}

export async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

/** CSRF origin check + per-IP rate limit. Returns a Response if the request must be rejected. */
export async function guard(action: string, ipLimit: number, windowSec: number) {
  if (!(await sameOrigin())) return json({ error: "Invalid request origin." }, 403);
  if (!(await rateLimit(`${action}:ip:${await clientIp()}`, ipLimit, windowSec)))
    return json({ error: "Too many attempts. Please try again later." }, 429);
  return null;
}

export async function cleanup() {
  await pool.query("DELETE FROM sessions WHERE expires_at<now()");
  await pool.query("DELETE FROM auth_tokens WHERE expires_at<now()");
  await pool.query("DELETE FROM rate_limits WHERE reset_at<now()");
}

/* ---------- sessions (random token in httpOnly cookie, only its hash is stored) ---------- */
const COOKIE = isProd ? "__Host-crp_session" : "crp_session";

export async function createSession(userId: string, remember: boolean) {
  const token = newToken();
  const ttl = remember ? 30 * 86400 : 86400;
  await pool.query(
    "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+make_interval(secs=>$3))",
    [sha256(token), userId, ttl]
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: isProd, sameSite: "lax", path: "/",
    ...(remember ? { maxAge: ttl } : {}),
  });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.id,u.email,u.full_name,u.roll_number FROM sessions s
     JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [sha256(token)]
  );
  return (rows[0] as { id: string; email: string; full_name: string; roll_number: string }) ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [sha256(token)]);
  jar.delete(COOKIE);
}

/* ---------- email (Resend HTTP API; SMTP ports are blocked on Render's free tier) ---------- */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (text: string) =>
  esc(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");

export async function sendMail(to: string, subject: string, text: string) {
  try {
    const url = process.env.MAIL_SCRIPT_URL;
    const secret = process.env.MAIL_SCRIPT_SECRET;
    if (!url || !secret) {
      if (isProd) console.error("MAIL_SCRIPT_URL / MAIL_SCRIPT_SECRET not set; email not sent");
      else console.log(`\n[dev mail] to=${to}\n${subject}\n${text}\n`);
      return;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret, to, subject, body: toHtml(text) }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => null);
    if (!data?.success) console.error("Mail script error:", data?.error ?? res.status);
  } catch (e) {
    console.error("Email send failed", e);
  }
}

export async function sendVerificationEmail(userId: string, email: string) {
  const t = await issueToken(userId, "verify", 24 * 60);
  void sendMail(email, "Verify your Campus Ride Pooling account",
    `Welcome to Campus Ride Pooling!\n\nConfirm your IITK email (valid for 24 hours):\n${appUrl()}/api/auth/verify?token=${t}\n\nIf you didn't sign up, you can ignore this email.`);
}

export async function sendResetEmail(userId: string, email: string) {
  const t = await issueToken(userId, "reset", 30);
  void sendMail(email, "Reset your Campus Ride Pooling password",
    `Reset your password (link valid for 30 minutes):\n${appUrl()}/reset-password?token=${t}\n\nIf you didn't request this, ignore this email; your password is unchanged.`);
}
