import { describe, expect, it } from "vitest";
import { calculatePickupOrderImpact } from "./pickup-order-impact";

const times: Record<string, number> = {
  "A|B": 4, "B|A": 4,
  "A|C": 5, "C|A": 5,
  "A|D": 8, "D|A": 8,
  "B|C": 3, "C|B": 3,
  "B|D": 6, "D|B": 6,
  "C|D": 2, "D|C": 2,
};

const lookup = (from: string, to: string): number | null =>
  from === to ? 0 : (times[`${from}|${to}`] ?? null);

describe("calculatePickupOrderImpact", () => {
  it("returns a route and zero impact for an already-present stop", () => {
    const result = calculatePickupOrderImpact(["A", "B"], "a", lookup);
    expect(result).not.toBeNull();
    expect(result?.changesPickupOrder).toBe(false);
    expect(result?.affectedStops).toBe(0);
    expect(result?.additionalTravelMinutes).toBe(0);
  });

  it("compares optimized route durations after adding a new stop", () => {
    const result = calculatePickupOrderImpact(["A", "C"], "B", lookup);
    expect(result).not.toBeNull();
    expect(result?.existingOrder).toHaveLength(2);
    expect(result?.proposedOrder).toHaveLength(3);
    expect(result?.proposedOrder).toContain("B");
    expect(result?.additionalTravelMinutes).toBe(2);
    // The new stop adds a detour, but existing stops retain their relative order.
    expect(result?.changesPickupOrder).toBe(false);
    expect(result?.affectedStops).toBe(0);
  });

  it("returns null when a route leg has no travel-time data", () => {
    const result = calculatePickupOrderImpact(["Unknown A"], "Unknown B", () => null);
    expect(result).toBeNull();
  });

  it("deduplicates locations so multiple riders at one stop count as one stop", () => {
    const result = calculatePickupOrderImpact(["A", "A", "C"], "B", lookup);
    expect(result?.existingOrder).toHaveLength(2);
    expect(result?.proposedOrder).toHaveLength(3);
    expect(result?.proposedOrder).toContain("B");
  });

  it("rejects an empty proposed stop", () => {
    expect(calculatePickupOrderImpact(["A"], "  ", lookup)).toBeNull();
  });
});
