/** Privacy gate for the already-intersected shared tag labels. */
export function resolveSharedInterestTags(input: {
  allParticipantsConsented: boolean;
  allParticipantsHaveVisibleTags: boolean;
  sharedTagNames: readonly string[] | null;
}): string[] | null {
  if (!input.allParticipantsConsented || !input.allParticipantsHaveVisibleTags) return null;
  return [...new Set(input.sharedTagNames ?? [])].sort((a, b) => a.localeCompare(b));
}
