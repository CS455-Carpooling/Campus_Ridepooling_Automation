import { adminActionResponse, adminRefusal, withAdminAction } from '@/lib/admin-actions';
import { requireAdminApi } from '@/lib/admin-auth';
import { json, readJson } from '@/lib/auth';
import { listOpenChatComplaints, resolveChatComplaint } from '@/lib/ride-chat';

// Admin access goes through requireAdminApi, like every other admin route: 401 signed out, 403
// for anyone else, and the same-origin check and rate limit on the change (SYS-NFR-03).
export async function GET() {
  const access = await requireAdminApi();
  if ('response' in access) return access.response;
  return json({ reports: await listOpenChatComplaints() });
}

/**
 * Resolves an open chat report. Like every state-changing admin action it runs through
 * withAdminAction, so it is atomic and leaves an audit record of each attempt (SYS-FR-45, 48;
 * SYS-NFR-06). The complaint the report became stays with the complaint review.
 */
export async function PATCH(request: Request) {
  const access = await requireAdminApi({ write: true });
  if ('response' in access) return access.response;
  const body = await readJson(request);
  const reference = typeof body.reference === 'string' ? body.reference : '';
  if (!/^chat-[0-9a-f]{8}$/i.test(reference)) {
    return json({ error: 'A valid complaint reference is required.' }, 400);
  }
  const result = await withAdminAction(
    access.admin,
    { action: 'chat_report.resolve', entityType: 'chat_report', entityId: reference },
    async (client) =>
      (await resolveChatComplaint(reference, client))
        ? {
            ok: true,
            value: reference,
            before: { status: 'open' },
            after: { status: 'resolved' },
          }
        : adminRefusal(404, 'not_found', 'Open complaint not found.'),
  );
  return adminActionResponse(result, () => ({ reference, status: 'resolved' }));
}
