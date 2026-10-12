import type { ApiError } from '@/lib/admin-types';

/** The answer of an admin API: its body, or the refusal with its field messages. */
export type AdminResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      fields: Record<string, string>;
      /** On a 409 `version_conflict`: the item as another admin left it. */
      current?: unknown;
    };

/**
 * Sends a change to an admin API (CS455-50, 52) and reads the answer. It never throws: a lost
 * connection comes back as a refusal with status 0, so every form can show it the same way.
 */
export async function sendAdminChange<T>(
  method: 'POST' | 'PATCH' | 'PUT',
  url: string,
  body: unknown,
): Promise<AdminResponse<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Partial<ApiError> & {
      current?: unknown;
    };
    if (response.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      status: response.status,
      error: data.error ?? 'The change could not be saved. Try again.',
      code: data.code ?? 'unknown',
      fields: data.fields ?? {},
      current: data.current,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'Unable to reach the server. Check your connection and try again.',
      code: 'network',
      fields: {},
    };
  }
}
