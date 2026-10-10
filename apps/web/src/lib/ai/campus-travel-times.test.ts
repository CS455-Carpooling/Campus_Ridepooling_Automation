import { describe, expect, it } from "vitest";
import {
  CAMPUS_TRAVEL_TIME_LOCATIONS,
  getCampusTravelTimeMatrix,
  getCampusTravelTimeMinutes,
} from "./campus-travel-times";

describe("hardcoded campus travel-time matrix", () => {
  it("contains Hall 1–Hall 14 and Main Gate", () => {
    expect(CAMPUS_TRAVEL_TIME_LOCATIONS).toHaveLength(15);
    expect(CAMPUS_TRAVEL_TIME_LOCATIONS).toContain("Hall 1");
    expect(CAMPUS_TRAVEL_TIME_LOCATIONS).toContain("Hall 14");
    expect(CAMPUS_TRAVEL_TIME_LOCATIONS).toContain("Main Gate");
  });

  it("has zero diagonal and symmetric non-negative values", () => {
    const matrix = getCampusTravelTimeMatrix();
    for (const from of CAMPUS_TRAVEL_TIME_LOCATIONS) {
      expect(matrix[from][from]).toBe(0);
      for (const to of CAMPUS_TRAVEL_TIME_LOCATIONS) {
        expect(matrix[from][to]).toBeGreaterThanOrEqual(0);
        expect(matrix[from][to]).toBe(matrix[to][from]);
      }
    }
  });

  it("satisfies the triangle inequality for the placeholder matrix", () => {
    const matrix = getCampusTravelTimeMatrix();
    for (const from of CAMPUS_TRAVEL_TIME_LOCATIONS) {
      for (const to of CAMPUS_TRAVEL_TIME_LOCATIONS) {
        for (const via of CAMPUS_TRAVEL_TIME_LOCATIONS) {
          expect(matrix[from][to]).toBeLessThanOrEqual(matrix[from][via] + matrix[via][to]);
        }
      }
    }
  });

  it("looks up names case-insensitively and reports unknown locations", () => {
    expect(getCampusTravelTimeMinutes("hall 1", "MAIN GATE")).toBeGreaterThan(0);
    expect(getCampusTravelTimeMinutes("Hall 1", "Hall 1")).toBe(0);
    expect(getCampusTravelTimeMinutes("Unknown", "Hall 1")).toBeNull();
  });
});
