import { pool } from "@/lib/db";
import { consumeToken, guard, hashPassword, readJson, json } from "@/lib/auth";

export async function POST(req: Request) {
  const blocked = await guard("reset", 10, 3600);
  if (blocked) return blocked;

  const b = await readJson(req);
  const token = typeof b.token === "string" ? b.token : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8 || password.length > 128)
    return json({ error: "Password must be 8 to 128 characters." }, 400);

  const userId = token ? await consumeToken(token, "reset") : null;
  if (!userId) return json({ error: "This reset link is invalid or has expired." }, 400);

  const hash = await hashPassword(password);
  await pool.query(
    "UPDATE users SET password_hash=$1, email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$2",
    [hash, userId]);
  await pool.query("DELETE FROM sessions WHERE user_id=$1", [userId]); // sign out everywhere
  return json({ ok: true });
}
