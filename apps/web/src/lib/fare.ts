/**
 * Fare shares in whole rupees (D1 rider requirements, Table T-2 and FR-RD-08).
 * Occupants are ordered owner first, then riders in the order they were
 * accepted.
 */

function assertWholeRupees(totalFare: number): void {
  if (!Number.isSafeInteger(totalFare) || totalFare < 0) {
    throw new RangeError('The total fare must be a whole number of rupees, zero or more.');
  }
}

function assertOccupants(occupants: number): void {
  if (!Number.isSafeInteger(occupants) || occupants < 1) {
    throw new RangeError('A ride has at least one occupant.');
  }
}

/**
 * Splits the total fare F between n occupants (Table T-2, FR-RD-08.4). With
 * q = floor(F / n) and r = F - n * q, the first r occupants pay q + 1 and the
 * rest pay q, so the shares always add up to exactly F.
 */
export function splitFare(totalFare: number, occupants: number): number[] {
  assertWholeRupees(totalFare);
  assertOccupants(occupants);
  const base = Math.floor(totalFare / occupants);
  const remainder = totalFare - occupants * base;
  return Array.from({ length: occupants }, (_, index) => (index < remainder ? base + 1 : base));
}

/**
 * The share shown to a rider before they ask to join (FR-RD-08.1): the total
 * fare divided by the current occupants plus one, rounded up to the next
 * rupee. It is never lower than the share assigned on joining.
 */
export function estimateShare(totalFare: number, currentOccupants: number): number {
  assertWholeRupees(totalFare);
  assertOccupants(currentOccupants);
  return Math.ceil(totalFare / (currentOccupants + 1));
}
