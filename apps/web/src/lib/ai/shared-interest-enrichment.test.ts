import { describe, expect, it } from "vitest";
import { resolveSharedInterestTags } from "./shared-interest-enrichment";

describe("resolveSharedInterestTags", () => {
  it("returns only shared labels when all participants consent and have visible tags", () => {
    expect(resolveSharedInterestTags({
      allParticipantsConsented: true,
      allParticipantsHaveVisibleTags: true,
      sharedTagNames: ["Hobbies", "Academic tracks", "Hobbies"],
    })).toEqual(["Academic tracks", "Hobbies"]);
  });

  it("omits the factor when any participant has not consented", () => {
    expect(resolveSharedInterestTags({
      allParticipantsConsented: false,
      allParticipantsHaveVisibleTags: true,
      sharedTagNames: ["Hobbies"],
    })).toBeNull();
  });

  it("omits the factor when any participant has no usable visible tags", () => {
    expect(resolveSharedInterestTags({
      allParticipantsConsented: true,
      allParticipantsHaveVisibleTags: false,
      sharedTagNames: ["Hobbies"],
    })).toBeNull();
  });

  it("returns an empty list when usable tags exist but there is no common interest", () => {
    expect(resolveSharedInterestTags({
      allParticipantsConsented: true,
      allParticipantsHaveVisibleTags: true,
      sharedTagNames: null,
    })).toEqual([]);
  });
});
