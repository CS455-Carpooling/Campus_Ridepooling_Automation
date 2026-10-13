import { requireAdminApi } from '@/lib/admin-auth';
import { openIncidentSummary } from '@/lib/admin-incident-queries';
import { json } from '@/lib/auth';

/**
 * GET /api/admin/incidents/open (CS455-65, P-22): how many SOS alerts nobody has acknowledged,
 * and the newest of them. Every admin page asks every few seconds, so a new alert shows within
 * 5 seconds. 401 signed out, 403 for anyone but an admin.
 */
export async function GET() {
  const access = await requireAdminApi();
  if ('response' in access) return access.response;
  return json(await openIncidentSummary());
}
