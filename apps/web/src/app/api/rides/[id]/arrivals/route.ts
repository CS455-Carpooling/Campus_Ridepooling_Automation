import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { markNoShow, setArrival } from '@/lib/trip';
import { runTripChange } from '@/lib/trip-api';
import { parseArrivalRequest, seatRefusalMessages } from '@/lib/trip-rules';

/**
 * POST /api/rides/[id]/arrivals (CS455-62: FR-RO-09.3, FR-RO-10.1 to 10.3): during pickup the
 * owner marks a rider Arrived, undoes it, or marks them a no-show. Body `{ occupantId, status:
 * 'arrived' | 'not_arrived' | 'no_show' }`, naming the seat (riders.id). 200 `{ seat }`; 403
 * `not_owner`; 404 for an unknown ride or seat; 409 with the reason, and for a no-show before
 * the grace period ends, `grace_period` with `availableAt`.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/rides/[id]/arrivals'>) {
  const blocked = await guard('trip-arrival', 120, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);
  const parsed = parseArrivalRequest(await readJson(req));
  if (!parsed.ok) {
    return json(
      { error: Object.values(parsed.errors)[0], code: 'invalid', fields: parsed.errors },
      400,
    );
  }

  const { occupantId, status } = parsed.value;
  return runTripChange(
    'Trip arrival',
    seatRefusalMessages,
    (client) =>
      status === 'no_show'
        ? markNoShow(client, id, user.id, occupantId, new Date())
        : setArrival(client, id, user.id, occupantId, status === 'arrived', new Date()),
    (seat) => ({ seat }),
  );
}
