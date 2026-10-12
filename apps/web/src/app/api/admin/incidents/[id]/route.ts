import { adminActionResponse, adminRefusal, withAdminAction } from '@/lib/admin-actions';
import { invalidRequest, notFound } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { readJson } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { changeIncident } from '@/lib/incidents';
import { parseIncidentAction } from '@/lib/sos-rules';

/**
 * PATCH /api/admin/incidents/[id] (CS455-65): an operations admin acknowledges an SOS alert,
 * `{ action: 'acknowledge' }`, or closes it with a note, `{ action: 'close', note }`. Audited
 * through withAdminAction. 200 `{ incident }`; 400 without a note; 404; 409 `closed` or
 * `already_acknowledged` with `current`.
 */
export async function PATCH(req: Request, ctx: RouteContext<'/api/admin/incidents/[id]'>) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound('SOS incident');
  const parsed = parseIncidentAction(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);
  const action = parsed.value;

  const result = await withAdminAction(
    access.admin,
    {
      action: action.action === 'acknowledge' ? 'incident.acknowledge' : 'incident.close',
      entityType: 'sos_incident',
      entityId: id,
      reason: action.action === 'close' ? action.note : null,
    },
    async (client) => {
      const change = await changeIncident(client, id, action, access.admin.userId, new Date());
      switch (change.kind) {
        case 'changed':
          return { ok: true, value: change.after, before: change.before, after: change.after };
        case 'not_found':
          return adminRefusal(404, 'not_found', 'SOS incident not found.');
        case 'refused':
          return {
            ...adminRefusal(
              409,
              change.code,
              change.code === 'closed'
                ? 'This incident is already closed.'
                : 'This incident is already acknowledged.',
            ),
            current: change.current,
          };
      }
    },
  );
  return adminActionResponse(result, (incident) => ({ incident }));
}
