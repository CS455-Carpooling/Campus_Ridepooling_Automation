/**
 * Temporary, hardcoded campus driving-time estimates for IIT Kanpur.
 *
 * Values are minutes between the named pickup points, intended for ranking/
 * comparing pickup-order changes—not for navigation or ETA promises. They are
 * rough symmetric estimates inferred from the campus layout and Google Maps/
 * campus-map references, not live Google Routes API results. Replace this
 * module with a routing-provider or admin-configured matrix when available.
 *
 * Matrix order is defined by CAMPUS_TRAVEL_TIME_LOCATIONS. Unknown locations
 * return null rather than being treated as zero travel time.
 */

export const CAMPUS_TRAVEL_TIME_LOCATIONS = [
  "Hall 1",
  "Hall 2",
  "Hall 3",
  "Hall 4",
  "Hall 5",
  "Hall 6",
  "Hall 7",
  "Hall 8",
  "Hall 9",
  "Hall 10",
  "Hall 11",
  "Hall 12",
  "Hall 13",
  "Hall 14",
  "Main Gate",
] as const;

export type CampusTravelTimeLocation = (typeof CAMPUS_TRAVEL_TIME_LOCATIONS)[number];

/** Symmetric estimated driving time in minutes; diagonal is zero. */
const TRAVEL_TIME_MINUTES: readonly (readonly number[])[] = [
  [0, 4, 5, 8, 4, 10, 8, 10, 8, 10, 11, 8, 10, 13, 14],
  [4, 0, 4, 7, 5, 8, 6, 8, 7, 8, 10, 9, 11, 14, 12],
  [5, 4, 0, 6, 4, 8, 7, 8, 8, 9, 10, 8, 9, 12, 13],
  [8, 7, 6, 0, 8, 4, 4, 5, 6, 7, 7, 11, 11, 14, 10],
  [4, 5, 4, 8, 0, 10, 8, 10, 9, 11, 12, 7, 8, 12, 15],
  [10, 8, 8, 4, 10, 0, 5, 4, 7, 6, 5, 12, 13, 15, 9],
  [8, 6, 7, 4, 8, 5, 0, 4, 4, 5, 6, 11, 13, 15, 9],
  [10, 8, 8, 5, 10, 4, 4, 0, 5, 4, 4, 13, 14, 17, 8],
  [8, 7, 8, 6, 9, 7, 4, 5, 0, 4, 7, 13, 14, 17, 8],
  [10, 8, 9, 7, 11, 6, 5, 4, 4, 0, 5, 14, 15, 18, 7],
  [11, 10, 10, 7, 12, 5, 6, 4, 7, 5, 0, 15, 15, 18, 7],
  [8, 9, 8, 11, 7, 12, 11, 13, 13, 14, 15, 0, 4, 8, 18],
  [10, 11, 9, 11, 8, 13, 13, 14, 14, 15, 15, 4, 0, 6, 19],
  [13, 14, 12, 14, 12, 15, 15, 17, 17, 18, 18, 8, 6, 0, 22],
  [14, 12, 13, 10, 15, 9, 9, 8, 8, 7, 7, 18, 19, 22, 0],
];

const LOCATION_INDEX: ReadonlyMap<string, number> = new Map(
  CAMPUS_TRAVEL_TIME_LOCATIONS.map((name, index) => [name.toLowerCase(), index]),
);

/**
 * Returns the estimated driving time in minutes, or null if either name is
 * not one of the hardcoded campus locations. Names are case-insensitive.
 */
export function getCampusTravelTimeMinutes(from: string, to: string): number | null {
  const fromIndex = LOCATION_INDEX.get(from.trim().toLowerCase());
  const toIndex = LOCATION_INDEX.get(to.trim().toLowerCase());

  if (fromIndex === undefined || toIndex === undefined) return null;
  return TRAVEL_TIME_MINUTES[fromIndex][toIndex];
}

/** Exposes a read-only lookup table for deterministic consumers and tests. */
export function getCampusTravelTimeMatrix(): Readonly<Record<CampusTravelTimeLocation, Readonly<Record<CampusTravelTimeLocation, number>>>> {
  return Object.fromEntries(
    CAMPUS_TRAVEL_TIME_LOCATIONS.map((from, fromIndex) => [
      from,
      Object.fromEntries(
        CAMPUS_TRAVEL_TIME_LOCATIONS.map((to, toIndex) => [
          to,
          TRAVEL_TIME_MINUTES[fromIndex][toIndex],
        ]),
      ),
    ]),
  ) as Readonly<Record<CampusTravelTimeLocation, Readonly<Record<CampusTravelTimeLocation, number>>>>;
}
