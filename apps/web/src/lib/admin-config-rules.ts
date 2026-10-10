/**
 * Rules for what an operations admin may configure (OA-FR-01 to 11, CS455-46): vehicle types,
 * campus places and transport hubs, and fares. Shared by the configuration pages and the
 * configuration API, so both check the same way; the database enforces the limits again.
 * D1 leaves the exact limits open, so these are the team's defaults. Pure functions only.
 */
import { RIDE_RULES } from './ride-rules';

export const ADMIN_CONFIG_RULES = {
  nameMin: 2,
  nameMax: 40,
  detailMax: 80,
  /** People the vehicle carries, the ride owner included; the largest today, Vikram, takes 7. */
  capacityMin: 1,
  capacityMax: 12,
  fareMin: RIDE_RULES.minFare,
  fareMax: RIDE_RULES.maxFare,
} as const;

export const LOCATION_TYPES = ['campus', 'transport_hub'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const locationTypeLabels: Record<LocationType, string> = {
  campus: 'Campus place',
  transport_hub: 'Transport hub',
};

export const adminConfigMessages = {
  name: `Enter a name of ${ADMIN_CONFIG_RULES.nameMin} to ${ADMIN_CONFIG_RULES.nameMax} characters.`,
  detail: `Keep the detail to ${ADMIN_CONFIG_RULES.detailMax} characters or fewer.`,
  capacity: `Enter a capacity from ${ADMIN_CONFIG_RULES.capacityMin} to ${ADMIN_CONFIG_RULES.capacityMax} people.`,
  type: 'Choose whether this is a campus place or a transport hub.',
  isActive: 'Choose whether it is active.',
  version: 'Reload the page: this item is out of date.',
  fare: `Enter a fare in whole rupees, from ${ADMIN_CONFIG_RULES.fareMin} to ${ADMIN_CONFIG_RULES.fareMax}.`,
  range: 'The lowest fare must not be above the highest.',
  samePlace: 'Choose two different campus places.',
  place: 'Choose a place from the list.',
  vehicleType: 'Choose a vehicle type from the list.',
} as const;

export type ConfigErrors = Record<string, string>;
export type ConfigResult<T> = { ok: true; value: T } | { ok: false; errors: ConfigErrors };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWholeNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/** A name with its spaces tidied, or null when it is too short or too long. */
function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length >= ADMIN_CONFIG_RULES.nameMin && name.length <= ADMIN_CONFIG_RULES.nameMax
    ? name
    : null;
}

/** An optional detail: undefined when not given, null when cleared, else the trimmed text. */
function cleanDetail(value: unknown): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return false;
  const detail = value.trim();
  if (detail === '') return null;
  return detail.length <= ADMIN_CONFIG_RULES.detailMax ? detail : false;
}

const isVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;

/**
 * A stable ID for a new place or vehicle type, from its name: "Hall 15" becomes "hall-15".
 * IDs never change afterwards, so existing rides keep pointing at the same place (OA-FR-06).
 * Empty when the name has no Latin letters or digits; the caller then has to choose an ID.
 */
export function idFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export type VehicleTypeCreate = { name: string; capacity: number };

export function parseVehicleTypeCreate(body: unknown): ConfigResult<VehicleTypeCreate> {
  const input = isRecord(body) ? body : {};
  const errors: ConfigErrors = {};
  const name = cleanName(input.name);
  if (!name) errors.name = adminConfigMessages.name;
  const { capacityMin, capacityMax } = ADMIN_CONFIG_RULES;
  if (!isWholeNumberIn(input.capacity, capacityMin, capacityMax)) {
    errors.capacity = adminConfigMessages.capacity;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name: name as string, capacity: input.capacity as number } };
}

export type VehicleTypeUpdate = {
  name?: string;
  capacity?: number;
  isActive?: boolean;
  version: number;
};

export function parseVehicleTypeUpdate(body: unknown): ConfigResult<VehicleTypeUpdate> {
  const input = isRecord(body) ? body : {};
  const errors: ConfigErrors = {};
  const value: VehicleTypeUpdate = { version: 0 };
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (name) value.name = name;
    else errors.name = adminConfigMessages.name;
  }
  if (input.capacity !== undefined) {
    const { capacityMin, capacityMax } = ADMIN_CONFIG_RULES;
    if (isWholeNumberIn(input.capacity, capacityMin, capacityMax)) value.capacity = input.capacity;
    else errors.capacity = adminConfigMessages.capacity;
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive === 'boolean') value.isActive = input.isActive;
    else errors.isActive = adminConfigMessages.isActive;
  }
  if (isVersion(input.version)) value.version = input.version;
  else errors.version = adminConfigMessages.version;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

export type LocationCreate = { type: LocationType; name: string; detail: string | null };

export function parseLocationCreate(body: unknown): ConfigResult<LocationCreate> {
  const input = isRecord(body) ? body : {};
  const errors: ConfigErrors = {};
  const type = (LOCATION_TYPES as readonly unknown[]).includes(input.type)
    ? (input.type as LocationType)
    : null;
  if (!type) errors.type = adminConfigMessages.type;
  const name = cleanName(input.name);
  if (!name) errors.name = adminConfigMessages.name;
  const detail = cleanDetail(input.detail);
  if (detail === false) errors.detail = adminConfigMessages.detail;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { type: type as LocationType, name: name as string, detail: detail || null },
  };
}

export type LocationUpdate = {
  name?: string;
  detail?: string | null;
  isActive?: boolean;
  version: number;
};

/** A place's type never changes: rides already use it as a hub or as a pickup point. */
export function parseLocationUpdate(body: unknown): ConfigResult<LocationUpdate> {
  const input = isRecord(body) ? body : {};
  const errors: ConfigErrors = {};
  const value: LocationUpdate = { version: 0 };
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (name) value.name = name;
    else errors.name = adminConfigMessages.name;
  }
  const detail = cleanDetail(input.detail);
  if (detail === false) errors.detail = adminConfigMessages.detail;
  else if (detail !== undefined) value.detail = detail;
  if (input.isActive !== undefined) {
    if (typeof input.isActive === 'boolean') value.isActive = input.isActive;
    else errors.isActive = adminConfigMessages.isActive;
  }
  if (isVersion(input.version)) value.version = input.version;
  else errors.version = adminConfigMessages.version;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value);

/** `version` is null for a fare that has not been set yet. */
const versionOrNull = (value: unknown): number | null | false =>
  value === null || value === undefined ? null : isVersion(value) ? value : false;

export type CampusFareInput = {
  /** The two places in ID order, as the database stores the pair. */
  fromId: string;
  toId: string;
  vehicleTypeId: string;
  fare: number;
  version: number | null;
};

export function parseCampusFare(body: unknown): ConfigResult<CampusFareInput> {
  const input = isRecord(body) ? body : {};
  const errors: ConfigErrors = {};
  if (!isId(input.fromId)) errors.fromId = adminConfigMessages.place;
  if (!isId(input.toId)) errors.toId = adminConfigMessages.place;
  if (isId(input.fromId) && input.fromId === input.toId)
    errors.toId = adminConfigMessages.samePlace;
  if (!isId(input.vehicleTypeId)) errors.vehicleTypeId = adminConfigMessages.vehicleType;
  const { fareMin, fareMax } = ADMIN_CONFIG_RULES;
  if (!isWholeNumberIn(input.fare, fareMin, fareMax)) errors.fare = adminConfigMessages.fare;
  const version = versionOrNull(input.version);
  if (version === false) errors.version = adminConfigMessages.version;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const [fromId, toId] = [input.fromId as string, input.toId as string].sort();
  return {
    ok: true,
    value: {
      fromId,
      toId,
      vehicleTypeId: input.vehicleTypeId as string,
      fare: input.fare as number,
      version: version as number | null,
    },
  };
}

export type ExternalFareRangeInput = {
  hubId: string;
  vehicleTypeId: string;
  minFare: number;
  maxFare: number;
  version: number | null;
};

export function parseExternalFareRange(body: unknown): ConfigResult<ExternalFareRangeInput> {
  const input = isRecord(body) ? body : {};
  const errors: ConfigErrors = {};
  if (!isId(input.hubId)) errors.hubId = adminConfigMessages.place;
  if (!isId(input.vehicleTypeId)) errors.vehicleTypeId = adminConfigMessages.vehicleType;
  const { fareMin, fareMax } = ADMIN_CONFIG_RULES;
  const minOk = isWholeNumberIn(input.minFare, fareMin, fareMax);
  const maxOk = isWholeNumberIn(input.maxFare, fareMin, fareMax);
  if (!minOk) errors.minFare = adminConfigMessages.fare;
  if (!maxOk) errors.maxFare = adminConfigMessages.fare;
  if (minOk && maxOk && (input.minFare as number) > (input.maxFare as number)) {
    errors.maxFare = adminConfigMessages.range;
  }
  const version = versionOrNull(input.version);
  if (version === false) errors.version = adminConfigMessages.version;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      hubId: input.hubId as string,
      vehicleTypeId: input.vehicleTypeId as string,
      minFare: input.minFare as number,
      maxFare: input.maxFare as number,
      version: version as number | null,
    },
  };
}
