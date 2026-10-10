import { getCurrentUser, guard, json } from '@/lib/auth';
import { searchRides, type SearchRideRequest } from '@/lib/ride-search';

const VALID_DIRECTIONS = new Set(['to_hub', 'from_hub']);

// ISO 8601 with a UTC offset, e.g. "2026-10-10T06:30:00+05:30".
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function parseIso(value: string | null): string | null {
  if (!value) return null;
  return ISO_WITH_OFFSET.test(value) ? value : null;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(req: Request) {
  const blocked = await guard('search-rides', 60, 60);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const { searchParams } = new URL(req.url);

  const direction = searchParams.get('direction');
  const hubId = searchParams.get('hubId');
  const campusLocationId = searchParams.get('campusLocationId');
  const departureStartRaw = searchParams.get('departureStart');
  const departureEndRaw = searchParams.get('departureEnd');
  const vehicleTypeId = searchParams.get('vehicleTypeId') || undefined;
  const maxFareShareRaw = searchParams.get('maxFareShare');

  // --- validation ---
  const errors: Record<string, string> = {};

  if (!direction || !VALID_DIRECTIONS.has(direction)) {
    errors.direction = 'Choose whether you are leaving campus or coming to campus.';
  }
  if (!hubId) errors.hubId = 'Choose a station, stand or airport.';
  if (!campusLocationId) errors.campusLocationId = 'Choose a campus location.';

  const departureStart = parseIso(departureStartRaw);
  const departureEnd = parseIso(departureEndRaw);

  if (!departureStart) {
    errors.departureStart = 'Enter a valid departure start time (ISO 8601 with offset).';
  }
  if (!departureEnd) {
    errors.departureEnd = 'Enter a valid departure end time (ISO 8601 with offset).';
  }
  if (departureStart && departureEnd && new Date(departureStart) >= new Date(departureEnd)) {
    errors.departureEnd = 'Departure end must be after departure start.';
  }

  const maxFareShare = parsePositiveInt(maxFareShareRaw);
  if (maxFareShareRaw && maxFareShare === null) {
    errors.maxFareShare = 'Max fare share must be a positive whole number of rupees.';
  }

  if (Object.keys(errors).length > 0) {
    return json({ error: 'Validation failed.', errors }, 400);
  }

  const filters: SearchRideRequest = {
    direction: direction as 'to_hub' | 'from_hub',
    hubId: hubId!,
    campusLocationId: campusLocationId!,
    departureStart: departureStart!,
    departureEnd: departureEnd!,
    vehicleTypeId,
    maxFareShare: maxFareShare ?? undefined,
  };

  try {
    const rides = await searchRides(user.id, filters);
    return json({ rides });
  } catch (error) {
    console.error('Search rides failed:', error);
    return json({ error: 'Unable to search for rides right now.' }, 500);
  }
}
