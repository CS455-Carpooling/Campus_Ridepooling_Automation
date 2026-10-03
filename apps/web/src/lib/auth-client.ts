/** The account endpoints of CS455-19 (src/app/api/auth). */
export const authApi = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  forgot: '/api/auth/forgot',
  reset: '/api/auth/reset',
  logout: '/api/auth/logout',
} as const;

export type AuthResult = { ok: true } | { ok: false; error: string };

const FALLBACK_ERROR = 'Something went wrong. Please try again.';

/**
 * Sends a form to an account endpoint as JSON. The endpoints answer
 * { ok: true } or { error: "message for the user" }.
 */
export async function postAuth(url: string, body: Record<string, unknown>): Promise<AuthResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' };
  }
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (response.ok && data?.ok) return { ok: true };
  return { ok: false, error: data?.error ?? FALLBACK_ERROR };
}
