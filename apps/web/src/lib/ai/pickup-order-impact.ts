import { getCampusTravelTimeMinutes } from "./campus-travel-times";

export type TravelTimeLookup = (from: string, to: string) => number | null;

export type PickupOrderImpact = {
  /** Whether the relative order of existing distinct stops changes. */
  changesPickupOrder: boolean;
  /** Count of existing stops whose index changes after removing the proposed stop. */
  affectedStops: number;
  /** Difference between optimized route durations, in minutes. Can be negative if the input matrix violates triangle inequality. */
  additionalTravelMinutes: number;
  /** Best order before adding the proposed stop. */
  existingOrder: string[];
  /** Best order after adding the proposed stop. */
  proposedOrder: string[];
};

type Route = { minutes: number; order: number[] };

/**
 * Finds a minimum-duration open path visiting each distinct stop once.
 * Held–Karp dynamic programming is practical for campus rides (the matrix has
 * at most 15 locations). Ties are deterministic: original input order wins.
 */
function shortestStopOrder(
  stops: readonly string[],
  travelTime: TravelTimeLookup,
): Route | null {
  if (stops.length <= 1) return { minutes: 0, order: stops.length ? [0] : [] };

  const memo = new Map<string, Route | null>();
  const solve = (mask: number, last: number): Route | null => {
    const key = `${mask}:${last}`;
    if (memo.has(key)) return memo.get(key)!;

    if (mask === (1 << last)) {
      const base = { minutes: 0, order: [last] };
      memo.set(key, base);
      return base;
    }

    const previousMask = mask & ~(1 << last);
    let best: Route | null = null;
    for (let previous = 0; previous < stops.length; previous += 1) {
      if ((previousMask & (1 << previous)) === 0) continue;
      const previousRoute = solve(previousMask, previous);
      const leg = travelTime(stops[previous], stops[last]);
      if (!previousRoute || leg === null || !Number.isFinite(leg) || leg < 0) continue;

      const candidate = {
        minutes: previousRoute.minutes + leg,
        order: [...previousRoute.order, last],
      };
      if (best === null || candidate.minutes < best.minutes) best = candidate;
    }

    memo.set(key, best);
    return best;
  };

  const fullMask = (1 << stops.length) - 1;
  let best: Route | null = null;
  for (let last = 0; last < stops.length; last += 1) {
    const candidate = solve(fullMask, last);
    if (candidate && (best === null || candidate.minutes < best.minutes)) best = candidate;
  }
  return best;
}

function uniqueStops(stops: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const stop of stops) {
    const normalized = stop.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(stop.trim());
  }
  return result;
}

/**
 * Estimates how adding a pickup changes the best stop order and open-route
 * duration. Each location is visited once, so riders at the same location
 * share a stop. Returns null if the supplied locations cannot be connected
 * using the provided travel-time lookup.
 *
 * This function ranks stop order only; it does not calculate road routes,
 * traffic-aware ETAs, or enforce a pickup/drop-off direction.
 */
export function calculatePickupOrderImpact(
  existingStops: readonly string[],
  proposedStop: string,
  travelTime: TravelTimeLookup = getCampusTravelTimeMinutes,
): PickupOrderImpact | null {
  const current = uniqueStops(existingStops);
  const proposedName = proposedStop.trim();
  if (!proposedName) return null;

  if (current.some((stop) => stop.toLocaleLowerCase() === proposedName.toLocaleLowerCase())) {
    const currentRoute = shortestStopOrder(current, travelTime);
    if (!currentRoute) return null;
    const order = currentRoute.order.map((index) => current[index]);
    return {
      changesPickupOrder: false,
      affectedStops: 0,
      additionalTravelMinutes: 0,
      existingOrder: order,
      proposedOrder: order,
    };
  }

  const expanded = [...current, proposedName];
  const before = shortestStopOrder(current, travelTime);
  const after = shortestStopOrder(expanded, travelTime);
  if (!before || !after) return null;

  const existingOrder = before.order.map((index) => current[index]);
  const proposedOrder = after.order.map((index) => expanded[index]);
  const proposedKey = proposedName.toLocaleLowerCase();
  const proposedWithoutNewStop = proposedOrder.filter(
    (stop) => stop.toLocaleLowerCase() !== proposedKey,
  );
  const beforePositions = new Map(
    existingOrder.map((stop, index) => [stop.toLocaleLowerCase(), index]),
  );
  const affectedStops = proposedWithoutNewStop.reduce(
    (count, stop, index) =>
      count + (beforePositions.get(stop.toLocaleLowerCase()) === index ? 0 : 1),
    0,
  );

  return {
    changesPickupOrder: affectedStops > 0,
    affectedStops,
    additionalTravelMinutes: after.minutes - before.minutes,
    existingOrder,
    proposedOrder,
  };
}
