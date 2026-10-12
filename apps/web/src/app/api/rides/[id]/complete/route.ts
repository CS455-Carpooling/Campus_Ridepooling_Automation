import { getCurrentUser, guard, json } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { ratingClosesAt } from '@/lib/rating-rules';
import { changeTripState } from '@/lib/trip';
import { runTripChange } from '@/lib/trip-api';
import { tripRefusalMessages } from '@/lib/trip-rules';

/**
 * POST /api/rides/[id]/complete (CS455-41, FR-RO-09.4): the owner marks the ride completed, which
 * stores the final pool and shares and opens rating for 72 hours (P-16). Since CS455-62 the trip
 * must have started: it is the same step as POST /api/rides/[id]/trip with `to: 'completed'`.
 * Asking again for a completed ride changes nothing. Anyone who may not see the ride gets the
 * same 404 as for a ride that does not exist.
 */
export async function POST(_req: Request, ctx: RouteContext<'/api/rides/[id]/complete'>) {
  const blocked = await guard('complete-ride', 30, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);

  return runTripChange(
    'Complete ride',
    tripRefusalMessages,
    (client) => changeTripState(client, id, user.id, 'completed', new Date()),
    (ride) => ({
      ride: {
        id: ride.id,
        state: ride.state,
        completedAt: ride.completedAt,
        ratingClosesAt: ride.completedAt
          ? ratingClosesAt(new Date(ride.completedAt)).toISOString()
          : null,
      },
    }),
  );
}
