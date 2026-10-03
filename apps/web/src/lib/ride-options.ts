import 'server-only';

/** A place a ride starts or ends at. IDs are text codes, the same as in the database seed. */
export type Place = {
  id: string;
  name: string;
  /** A second line, for example "Railway station". */
  detail?: string;
};

export type VehicleType = {
  id: string;
  name: string;
  /** Everyone the vehicle carries, the ride owner included. */
  capacity: number;
};

export type RideFormOptions = {
  /** Halls and Main Gate: where the owner and each rider are picked up or dropped. */
  campusPlaces: Place[];
  /** The fixed transport hubs a ride goes to or comes from. */
  hubs: Place[];
  vehicleTypes: VehicleType[];
};

// Agreed with the database task (CS455-22): SYS-FR-09 places and the fixed
// vehicle types. Capacities are tentative.
const campusPlaces: Place[] = [
  ...Array.from({ length: 14 }, (_, index) => ({
    id: `hall-${index + 1}`,
    name: `Hall ${index + 1}`,
  })),
  { id: 'main-gate', name: 'Main Gate' },
];

const hubs: Place[] = [
  { id: 'kanpur-central', name: 'Kanpur Central', detail: 'Railway station' },
  { id: 'kanpur-anwarganj', name: 'Kanpur Anwarganj', detail: 'Railway station' },
  { id: 'bus-stand', name: 'Bus stand', detail: 'Kanpur' },
  { id: 'metro-station', name: 'Metro station', detail: 'Kanpur Metro' },
  { id: 'kanpur-airport', name: 'Kanpur airport', detail: 'Airport' },
  { id: 'lucknow-airport', name: 'Lucknow airport', detail: 'Airport' },
];

const vehicleTypes: VehicleType[] = [
  { id: 'car', name: 'Car', capacity: 4 },
  { id: 'auto', name: 'Auto', capacity: 3 },
  { id: 'vikram', name: 'Vikram', capacity: 7 },
];

/**
 * The choices of the create-ride form. Until the rides database (CS455-22) is
 * on master these are the fixed lists above; then only this function changes,
 * to read the seeded tables.
 */
export async function getRideFormOptions(): Promise<RideFormOptions> {
  return { campusPlaces, hubs, vehicleTypes };
}
