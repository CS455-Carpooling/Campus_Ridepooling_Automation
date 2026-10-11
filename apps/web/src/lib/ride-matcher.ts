export type MatchRequest = {
  id: string;
  earliestDeparture: Date | string;
  latestDeparture: Date | string;
  partySize: number;
};

export type MatchGroup = {
  id: string;
  windowStart: Date | string;
  windowEnd: Date | string;
  vehicleCapacity: number;
  currentPartySize: number;
};

export type BestGroupResult = {
  groupId: string | null;
  candidateId: string | null;
  windowShrink: number;
};

const toMs = (value: Date | string) => new Date(value).getTime();

/**
 * A4: when two feasible groups are available for a rider request, assign to the
 * group that requires the smaller window shrink. The request must fit in the
 * group's window without exceeding capacity and the windows must overlap.
 */
export function chooseBestFeasibleGroup(
  request: MatchRequest,
  groups: MatchGroup[],
): BestGroupResult {
  const requestStart = toMs(request.earliestDeparture);
  const requestEnd = toMs(request.latestDeparture);
  const partySize = Number(request.partySize ?? 1);

  if (!Number.isFinite(requestStart) || !Number.isFinite(requestEnd) || partySize <= 0) {
    return { groupId: null, candidateId: null, windowShrink: Number.POSITIVE_INFINITY };
  }

  let best: BestGroupResult = {
    groupId: null,
    candidateId: null,
    windowShrink: Number.POSITIVE_INFINITY,
  };

  for (const group of groups) {
    const capacity = Number(group.vehicleCapacity ?? 0);
    const current = Number(group.currentPartySize ?? 0);
    if (capacity <= 0 || current < 0 || current + partySize > capacity) continue;

    const groupStart = toMs(group.windowStart);
    const groupEnd = toMs(group.windowEnd);
    if (!Number.isFinite(groupStart) || !Number.isFinite(groupEnd)) continue;

    const windowsOverlap = requestStart <= groupEnd && requestEnd >= groupStart;
    if (!windowsOverlap) continue;

    const overlapStart = Math.max(groupStart, requestStart);
    const overlapEnd = Math.min(groupEnd, requestEnd);
    if (overlapEnd <= overlapStart) continue;

    const groupWindowLength = Math.max(0, groupEnd - groupStart);
    const overlapLength = Math.max(0, overlapEnd - overlapStart);
    const windowShrink = Math.max(0, groupWindowLength - overlapLength);

    if (windowShrink < best.windowShrink) {
      best = { groupId: group.id, candidateId: group.id, windowShrink };
    }
  }

  return best;
}

/**
 * A6: if two single-person groups are compatible, a reconciliation pass merges
 * them into one group; this is the policy-aligned batch operation referenced in
 * the D1 admin matching criteria.
 */
export function reconcileCompatibleSingleSeatGroups(groups: MatchGroup[]): MatchGroup[] {
  const working = groups.map((group) => ({
    ...group,
    currentPartySize: Number(group.currentPartySize ?? 0),
    vehicleCapacity: Number(group.vehicleCapacity ?? 0),
  }));

  const merged: MatchGroup[] = [];
  const used = new Set<string>();

  for (let i = 0; i < working.length; i++) {
    if (used.has(working[i].id)) continue;

    let mergedGroup = working[i];
    let mergedPair: MatchGroup | null = null;

    for (let j = i + 1; j < working.length; j++) {
      if (used.has(working[j].id)) continue;

      const candidate = working[j];
      if (mergedGroup.currentPartySize !== 1 || candidate.currentPartySize !== 1) continue;
      if (mergedGroup.vehicleCapacity < 2 || candidate.vehicleCapacity < 2) continue;
      if (
        mergedGroup.currentPartySize + candidate.currentPartySize >
        Math.min(mergedGroup.vehicleCapacity, candidate.vehicleCapacity)
      ) {
        continue;
      }

      const mergedStart = Math.min(toMs(mergedGroup.windowStart), toMs(candidate.windowStart));
      const mergedEnd = Math.max(toMs(mergedGroup.windowEnd), toMs(candidate.windowEnd));
      const groupWindowsOverlap =
        toMs(mergedGroup.windowEnd) >= toMs(candidate.windowStart) &&
        toMs(candidate.windowEnd) >= toMs(mergedGroup.windowStart);
      const compatible = groupWindowsOverlap && mergedStart <= mergedEnd;
      if (!compatible) continue;

      mergedPair = {
        id: `${mergedGroup.id}:${candidate.id}`,
        windowStart: new Date(mergedStart),
        windowEnd: new Date(mergedEnd),
        vehicleCapacity: Math.min(mergedGroup.vehicleCapacity, candidate.vehicleCapacity),
        currentPartySize: 2,
      };

      used.add(mergedGroup.id);
      used.add(candidate.id);
      mergedGroup = mergedPair;
      break;
    }

    merged.push(mergedGroup);
  }

  for (const group of working) {
    if (!used.has(group.id)) merged.push(group);
  }

  return merged;
}

export const A4_ACCEPTANCE = 'A4: choose the feasible group with the minimum window shrink';
export const A6_ACCEPTANCE = 'A6: batch reconciliation merges compatible one-person groups';
