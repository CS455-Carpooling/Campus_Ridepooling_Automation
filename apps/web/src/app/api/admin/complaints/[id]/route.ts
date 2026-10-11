import {
  adminActionResponse,
  adminRefusal,
  versionConflict,
  withAdminAction,
} from '@/lib/admin-actions';
import { invalidRequest, notFound } from '@/lib/admin-api';
import { requireAdminApi } from '@/lib/admin-auth';
import { readJson } from '@/lib/auth';
import { complaintStatusLabels, parseComplaintStatusChange } from '@/lib/complaint-rules';
import { changeComplaintStatus } from '@/lib/complaints';
import { isUuid } from '@/lib/ids';

/**
 * PATCH /api/admin/complaints/[id] (OA-FR-18, FR-RD-13.5, CS455-52): moves a complaint to
 * Under review or Resolved. Body { status, actionTaken?, note?, version }; resolving needs
 * `actionTaken`. 200 { complaint }; 409 `version_conflict` with `current`, or `not_allowed`
 * for a resolved complaint or one already in that status.
 */
export async function PATCH(req: Request, ctx: RouteContext<'/api/admin/complaints/[id]'>) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound('Complaint');
  const parsed = parseComplaintStatusChange(await readJson(req));
  if (!parsed.ok) return invalidRequest(parsed.errors);

  const result = await withAdminAction(
    access.admin,
    {
      action: 'complaint.status',
      entityType: 'complaint',
      entityId: id,
      reason: parsed.value.note,
    },
    async (client) => {
      const change = await changeComplaintStatus(
        client,
        id,
        parsed.value,
        access.admin.userId,
        new Date(),
      );
      switch (change.kind) {
        case 'changed':
          return { ok: true, value: change.after, before: change.before, after: change.after };
        case 'not_found':
          return adminRefusal(404, 'not_found', 'Complaint not found.');
        case 'version_conflict':
          return versionConflict(change.current);
        case 'not_allowed':
          return {
            ...adminRefusal(
              409,
              'not_allowed',
              change.current.status === 'resolved'
                ? 'This complaint is already resolved, so its status cannot change.'
                : `This complaint is already ${complaintStatusLabels[change.current.status].toLowerCase()}.`,
            ),
            current: change.current,
          };
      }
    },
  );
  return adminActionResponse(result, (complaint) => ({ complaint }));
}
