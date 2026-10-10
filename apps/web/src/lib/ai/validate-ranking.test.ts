import { describe, expect, it } from "vitest";
import { validateAiRanking } from "./validate-ranking";
import type { RecommendationCandidate } from "./types";

const candidate = (overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate => ({
  rideId: "ride-1",
  estimatedFareShare: 120,
  departureStart: "2026-10-10T12:00:00.000Z",
  departureEnd: "2026-10-10T12:30:00.000Z",
  vehicleType: "Auto",
  availableSeats: 2,
  pickupOrderChange: { changesPickupOrder: false, affectedStops: 0 },
  sharedInterestTags: null,
  aggregateRating: null,
  trustIndicator: null,
  ...overrides,
});

describe("validateAiRanking", () => {
  it("accepts only eligible IDs and removes factors whose data is unavailable", () => {
    const result = validateAiRanking({ rankedRides: [
      { rideId: "unknown", factors: ["fare"], pros: [], cons: [] },
      { rideId: "ride-1", factors: ["fare", "shared_interests", "trust_indicator", "made_up"], pros: ["Lower estimated share"], cons: [] },
    ] }, [candidate()]);
    expect(result).toEqual([{
      rideId: "ride-1",
      factors: ["fare"],
      pros: ["Lower estimated share"],
      cons: [],
    }]);
  });

  it("rejects duplicate IDs and caps results at five", () => {
    const candidates = Array.from({ length: 6 }, (_, i) => candidate({ rideId: `ride-${i}` }));
    const result = validateAiRanking({ rankedRides: [
      ...candidates.map((c) => ({ rideId: c.rideId, factors: ["fare"], pros: [], cons: [] })),
      { rideId: "ride-0", factors: ["fare"], pros: [], cons: [] },
    ] }, candidates);
    expect(result).toHaveLength(5);
    expect(new Set(result.map((item) => item.rideId)).size).toBe(5);
  });

  it("rejects overlong or excessive explanations", () => {
    expect(validateAiRanking({ rankedRides: [{
      rideId: "ride-1", factors: ["fare"], pros: ["x".repeat(181)], cons: [],
    }] }, [candidate()])).toEqual([]);
    expect(validateAiRanking({ rankedRides: [{
      rideId: "ride-1", factors: ["fare"], pros: ["a", "b", "c", "d"], cons: [],
    }] }, [candidate()])).toEqual([]);
  });

  it("returns an empty ranking for malformed model output", () => {
    expect(validateAiRanking({ rankedRides: "not-an-array" }, [candidate()])).toEqual([]);
    expect(validateAiRanking(null, [candidate()])).toEqual([]);
  });
});
