import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { changeTripState, TRIP_STAMP_SQL } from '@/lib/trip';
import { runTripChange } from '@/lib/trip-api';
import { parseTripRequest, tripRefusalMessages } from '@/lib/trip-rules';

const unauthenticated = () =>
  json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);
const notFound = () => json({ error: 'Ride not found.', code: 'not_found' }, 404);

/**
 * GET /api/rides/[id]/trip (CS455-63, P-13): `{ state, stamp }` for someone with a seat on the
 * ride. The ride page asks for it every few seconds while the trip is under way and reads the
 * ride again only when the stamp changes. Anyone else gets the same 404 as for no ride.
 */
export async function GET(_req: Request, ctx: RouteContext<'/api/rides/[id]/trip'>) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const row = (await pool.query<{ state: string; stamp: string }>(TRIP_STAMP_SQL, [id, user.id]))
    .rows[0];
  if (!row) return notFound();
  return json({ state: row.state, stamp: row.stamp });
}

/**
 * POST /api/rides/[id]/trip (CS455-62: FR-RO-09.1, 09.4, FR-RD-10.1): the owner moves the trip
 * on. Body `{ to: 'pickup_in_progress' | 'in_transit' | 'completed' }`. 200 `{ ride }`, also when
 * the ride is already there; 403 `not_owner`; 409 `not_locked`, `not_started`,
 * `invalid_transition`, `cancelled` or `completed`.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/rides/[id]/trip'>) {
  const blocked = await guard('trip-step', 30, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return unauthenticated();
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const parsed = parseTripRequest(await readJson(req));
  if (!parsed.ok)
    return json({ error: parsed.errors.to, code: 'invalid', fields: parsed.errors }, 400);

  return runTripChange(
    'Trip step',
    tripRefusalMessages,
    (client) => changeTripState(client, id, user.id, parsed.value.to, new Date()),
    (ride) => ({ ride }),
  );
}
