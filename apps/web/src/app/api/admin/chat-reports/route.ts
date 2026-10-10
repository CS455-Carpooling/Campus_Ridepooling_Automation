import { getSession } from '@/lib/session';
import { json, readJson } from '@/lib/auth';
import { listOpenChatComplaints, resolveChatComplaint } from '@/lib/ride-chat';

async function requireAdmin() {
  const session = await getSession();
  if (!session) return json({ error: 'Authentication required.' }, 401);
  if (session.role !== 'admin') return json({ error: 'Administrator access required.' }, 403);
  return null;
}

export async function GET() {
  const blocked = await requireAdmin();
  if (blocked) return blocked;
  return json({ reports: await listOpenChatComplaints() });
}

export async function PATCH(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;
  const body = await readJson(request);
  const reference = typeof body.reference === 'string' ? body.reference : '';
  if (!/^chat-[0-9a-f]{8}$/i.test(reference)) {
    return json({ error: 'A valid complaint reference is required.' }, 400);
  }
  const resolved = await resolveChatComplaint(reference);
  if (!resolved) return json({ error: 'Open complaint not found.' }, 404);
  return json({ reference, status: 'resolved' });
}
