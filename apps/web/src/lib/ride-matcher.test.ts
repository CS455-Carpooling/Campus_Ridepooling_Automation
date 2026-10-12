import { describe, expect, it } from 'vitest';
import { chooseBestFeasibleGroup, reconcileCompatibleSingleSeatGroups } from './ride-matcher';

describe('A4 matching rule', () => {
  it('picks the feasible group with the smaller window shrink', () => {
    const request = {
      id: 'r-1',
      earliestDeparture: '2026-10-12T07:00:00.000Z',
      latestDeparture: '2026-10-12T09:00:00.000Z',
      partySize: 1,
    };

    const groups = [
      {
        id: 'g-a',
        windowStart: '2026-10-12T06:00:00.000Z',
        windowEnd: '2026-10-12T08:00:00.000Z',
        vehicleCapacity: 4,
        currentPartySize: 2,
      },
      {
        id: 'g-b',
        windowStart: '2026-10-12T06:30:00.000Z',
        windowEnd: '2026-10-12T08:30:00.000Z',
        vehicleCapacity: 4,
        currentPartySize: 2,
      },
    ];

    const result = chooseBestFeasibleGroup(request, groups);
    expect(result.groupId).toBe('g-b');
    expect(result.windowShrink).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});

describe('A6 batch reconciliation', () => {
  it('merges two compatible one-person groups', () => {
    const groups = [
      {
        id: 'g-1',
        windowStart: '2026-10-12T07:00:00.000Z',
        windowEnd: '2026-10-12T07:30:00.000Z',
        vehicleCapacity: 4,
        currentPartySize: 1,
      },
      {
        id: 'g-2',
        windowStart: '2026-10-12T07:15:00.000Z',
        windowEnd: '2026-10-12T08:00:00.000Z',
        vehicleCapacity: 4,
        currentPartySize: 1,
      },
      {
        id: 'g-3',
        windowStart: '2026-10-12T09:00:00.000Z',
        windowEnd: '2026-10-12T09:30:00.000Z',
        vehicleCapacity: 4,
        currentPartySize: 1,
      },
    ];

    const reconciled = reconcileCompatibleSingleSeatGroups(groups);
    const merged = reconciled.filter((group) => group.currentPartySize === 2);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toContain(':');
  });
});
