import { getCurrentUser, guard, json } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { raiseSos } from '@/lib/sos';
import { sosRefusalMessages } from '@/lib/sos-rules';
import { runTripChange } from '@/lib/trip-api';

/**
 * POST /api/rides/[id]/sos (CS455-64: FR-RD-15.1, 15.2, FR-RO-13.2): someone with a seat raises
 * an SOS while the trip is under way, suspended or not. 201 `{ incident }` for a new alert, 200
 * for the one already active; 404 for anyone without a seat; 409 `not_active` outside the trip.
 * The rest of the pool is never told. The rate limit is generous, and every refusal still names
 * the emergency numbers.
 */
export async function POST(_req: Request, ctx: RouteContext<'/api/rides/[id]/sos'>) {
  const blocked = await guard('sos', 20, 3600);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);

  return runTripChange(
    'SOS',
    sosRefusalMessages,
    (client) => raiseSos(client, id, user.id, new Date()),
    ({ incident }) => ({ incident }),
    { status: ({ created }) => (created ? 201 : 200) },
  );
}
