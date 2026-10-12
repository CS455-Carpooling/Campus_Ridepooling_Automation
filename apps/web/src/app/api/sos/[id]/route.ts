import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { updateSos } from '@/lib/sos';
import { parseSosUpdate, sosRefusalMessages } from '@/lib/sos-rules';
import { runTripChange } from '@/lib/trip-api';

const notFound = 'SOS alert not found.';

/**
 * PATCH /api/sos/[id] (CS455-64: FR-RD-15.2, 15.5): the person who raised the alert adds their
 * location, `{ latitude, longitude, accuracy? }`, or marks it a false alarm, `{ falseAlarm: true }`.
 * Each happens once. 200 `{ incident }`; 404 for anyone else; 409 `closed` once an admin closed it.
 */
export async function PATCH(req: Request, ctx: RouteContext<'/api/sos/[id]'>) {
  const blocked = await guard('sos-update', 30, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: notFound, code: 'not_found' }, 404);
  const parsed = parseSosUpdate(await readJson(req));
  if (!parsed.ok) return json({ error: parsed.error, code: 'invalid' }, 400);

  return runTripChange(
    'SOS update',
    sosRefusalMessages,
    (client) => updateSos(client, id, user.id, parsed.value, new Date()),
    (incident) => ({ incident }),
    { notFound },
  );
}
