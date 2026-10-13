import { getCurrentUser, guard, json } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { checkIn } from '@/lib/trip';
import { runTripChange } from '@/lib/trip-api';
import { seatRefusalMessages } from '@/lib/trip-rules';

/**
 * POST /api/rides/[id]/check-in (CS455-62, FR-RD-10.4): a rider says they are at their pickup
 * point, which everyone on the ride can see, from the lock until the trip starts. 200 `{ seat }`,
 * also when already checked in; 404 for anyone without a seat; 409 `not_open`, `owner_seat` or
 * `no_show`.
 */
export async function POST(_req: Request, ctx: RouteContext<'/api/rides/[id]/check-in'>) {
  const blocked = await guard('trip-check-in', 30, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);

  return runTripChange(
    'Trip check-in',
    seatRefusalMessages,
    (client) => checkIn(client, id, user.id, new Date()),
    (seat) => ({ seat }),
  );
}
