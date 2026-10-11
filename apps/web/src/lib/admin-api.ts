import 'server-only';
import { adminRefusal, versionConflict, type AdminActionResult } from './admin-actions';
import type { ConfigWrite } from './admin-config';
import type { EnforcementWrite } from './enforcement';
import { json } from './auth';

/** Shared answers of the admin APIs (CS455-50, 52): `{ error, code, fields?, current? }`. */

/** 400 with a message per field. */
export function invalidRequest(fields: Record<string, string>): Response {
  return json({ error: 'Check the highlighted fields.', code: 'invalid', fields }, 400);
}

export const notFound = (what: string) =>
  json({ error: `${what} not found.`, code: 'not_found' }, 404);

/** Vehicle type and place IDs are short slugs, such as "kanpur-central" (OA-FR-06). */
export const isConfigId = (value: string) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(value);

export function fromConfigWrite<T>(
  write: ConfigWrite<T>,
  idOf: (record: T) => string,
): AdminActionResult<T> {
  switch (write.kind) {
    case 'saved':
      return {
        ok: true,
        value: write.record,
        entityId: idOf(write.record),
        before: write.before,
        after: write.record,
      };
    case 'not_found':
      return adminRefusal(404, 'not_found', 'This item no longer exists. Reload the page.');
    case 'version_conflict':
      return versionConflict(write.current);
    case 'invalid':
      return adminRefusal(400, 'invalid', 'Check the highlighted fields.', write.fields);
  }
}

export function fromEnforcementWrite<T>(write: EnforcementWrite<T>): AdminActionResult<T> {
  switch (write.kind) {
    case 'done':
      return { ok: true, value: write.record, after: write.record };
    case 'not_found':
      return adminRefusal(404, 'not_found', 'Rider not found.');
    case 'not_a_rider':
      return adminRefusal(400, 'not_a_rider', 'Operations admins cannot be warned or suspended.');
    case 'complaint_mismatch':
      return adminRefusal(400, 'invalid', 'Check the highlighted fields.', {
        complaintId: 'That complaint is not about this rider.',
      });
    case 'already_suspended':
      return adminRefusal(
        409,
        'already_suspended',
        'This rider is already suspended. Reactivate them first to set a different suspension.',
      );
    case 'not_suspended':
      return adminRefusal(409, 'not_suspended', 'This rider is not suspended.');
  }
}
