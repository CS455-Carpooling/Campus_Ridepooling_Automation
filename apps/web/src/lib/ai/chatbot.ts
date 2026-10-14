import 'server-only';
import { routes } from '../routes';
import { isUuid } from '../ids';
import {
  executeChatbotTool,
  executeGetPublicProfile,
  executeGetRiderPreferences,
  executeSearchRides,
  executeProposePreferenceUpdate,
  type PublicProfileResult,
  type PublicRideDetailsResult,
} from './chatbot-tools';
import type { PreferenceProposal, ProposedPreferenceChanges } from './preference-proposals';
import type { SearchRideResult } from '../ride-search';
import {
  getRideFormOptions,
  type RideFormOptions,
  type Place,
  type VehicleType,
} from '../ride-options';

export const MAX_MESSAGE_LENGTH = 500; // AI-RD-09, US-RD-12-AC3

export type InterpretedFilters = {
  direction: 'to_hub' | 'from_hub';
  hubId: string;
  hubName: string;
  campusLocationId: string;
  campusLocationName: string;
  departureStart: string; // ISO 8601 with offset
  departureEnd: string; // ISO 8601 with offset
  vehicleTypeId?: string;
  vehicleTypeName?: string;
  maxFareShare?: number;
};

export type ChatbotResponse =
  | {
      kind: 'search_results';
      message: string;
      interpretedFilters: InterpretedFilters;
      rides: SearchRideResult[];
    }
  | {
      kind: 'clarification';
      message: string;
      missingField?: 'hub' | 'date' | 'direction';
    }
  | {
      kind: 'public_profile';
      message: string;
      profile: PublicProfileResult;
    }
  | {
      kind: 'preference_proposal';
      message: string;
      proposal: PreferenceProposal;
    }
  | {
      kind: 'prohibited_action';
      message: string;
      actionType: 'join' | 'leave' | 'pay' | 'rate' | 'complain' | 'chat' | 'sos';
      targetLink: {
        href: string;
        label: string;
      };
    }
  | {
      kind: 'out_of_scope';
      message: string;
    }
  | {
      kind: 'service_unavailable';
      message: string;
      fallbackLink: {
        href: string;
        label: string;
      };
    };

export type ChatbotOptions = {
  now?: Date;
  forceServiceFailure?: boolean;
  rideOptions?: RideFormOptions;
};

export const DEFAULT_HUBS: Place[] = [
  { id: 'kanpur-central', name: 'Kanpur Central', detail: 'Station' },
  { id: 'lucknow-airport', name: 'Lucknow airport', detail: 'Chaudhary Charan Singh International Airport' },
  { id: 'kanpur-airport', name: 'Kanpur airport', detail: 'Chakeri' },
  { id: 'bus-stand', name: 'Bus stand', detail: 'Jhakarkati' },
  { id: 'metro-station', name: 'Metro station', detail: 'IIT Kanpur Metro Station' },
  { id: 'kanpur-anwarganj', name: 'Kanpur Anwarganj', detail: 'Station' },
];

export const DEFAULT_CAMPUS_LOCATIONS: Place[] = [
  { id: 'hall-1', name: 'Hall 1' },
  { id: 'hall-2', name: 'Hall 2' },
  { id: 'hall-3', name: 'Hall 3' },
  { id: 'hall-4', name: 'Hall 4' },
  { id: 'hall-5', name: 'Hall 5' },
  { id: 'hall-6', name: 'Hall 6' },
  { id: 'hall-7', name: 'Hall 7' },
  { id: 'hall-8', name: 'Hall 8' },
  { id: 'hall-9', name: 'Hall 9' },
  { id: 'hall-10', name: 'Hall 10' },
  { id: 'hall-11', name: 'Hall 11' },
  { id: 'hall-12', name: 'Hall 12' },
  { id: 'hall-13', name: 'Hall 13' },
  { id: 'hall-14', name: 'Hall 14' },
  { id: 'main-gate', name: 'Main Gate' },
];

export const DEFAULT_VEHICLE_TYPES: VehicleType[] = [
  { id: 'auto', name: 'Auto', capacity: 3 },
  { id: 'car', name: 'Car', capacity: 4 },
  { id: 'vikram', name: 'Vikram', capacity: 6 },
];

/** Matches a transport hub against configured hubs in the database. */
export function matchHub(text: string, hubs: Place[]): Place | null {
  const lower = text.toLowerCase();
  if (!Array.isArray(hubs)) return null;

  // 1. Check exact configured hub name, id, or normalized id
  for (const h of hubs) {
    if (!h) continue;
    const hubNameLower = (h.name ?? '').toLowerCase();
    const hubIdNorm = (h.id ?? '').toLowerCase().replace(/[-_]/g, ' ');
    if ((hubNameLower && lower.includes(hubNameLower)) || (hubIdNorm && lower.includes(hubIdNorm))) {
      return h;
    }
  }

  // 2. Check well-known transport hub synonyms mapped to configured hubs
  for (const h of hubs) {
    if (!h) continue;
    const id = (h.id ?? '').toLowerCase();
    const name = (h.name ?? '').toLowerCase();

    // Kanpur Central / Railway Station
    if (id.includes('central') || name.includes('central') || name.includes('railway')) {
      if (
        lower.includes('central station') ||
        lower.includes('railway station') ||
        lower.includes('train station') ||
        lower.includes('kanpur central') ||
        lower.includes('station') ||
        lower.includes('central')
      ) {
        return h;
      }
    }

    // Lucknow Airport
    if (id.includes('lucknow') && (id.includes('airport') || name.includes('airport'))) {
      if (
        lower.includes('lucknow airport') ||
        lower.includes('lucknow') ||
        lower.includes('ccsi') ||
        lower.includes('amausi')
      ) {
        return h;
      }
    }

    // Kanpur Airport
    if (id.includes('kanpur') && (id.includes('airport') || name.includes('airport'))) {
      if (lower.includes('kanpur airport') || lower.includes('chakeri')) {
        return h;
      }
    }

    // Bus Stand
    if (id.includes('bus') || name.includes('bus')) {
      if (
        lower.includes('bus stand') ||
        lower.includes('bus station') ||
        lower.includes('jhakarkati') ||
        lower.includes('bus')
      ) {
        return h;
      }
    }

    // Metro Station
    if (id.includes('metro') || name.includes('metro')) {
      if (
        lower.includes('metro station') ||
        lower.includes('metro') ||
        lower.includes('iitk metro')
      ) {
        return h;
      }
    }

    // Anwarganj
    if (id.includes('anwarganj') || name.includes('anwarganj')) {
      if (lower.includes('anwarganj')) {
        return h;
      }
    }
  }

  // 3. Generic "airport" defaults to the first airport hub available in configured hubs
  if (lower.includes('airport')) {
    const airportHub = hubs.find(
      (h) => h && ((h.id ?? '').toLowerCase().includes('airport') || (h.name ?? '').toLowerCase().includes('airport')),
    );
    if (airportHub) return airportHub;
  }

  // 4. Generic "station" defaults to the first station hub available
  if (lower.includes('station')) {
    const stationHub = hubs.find(
      (h) =>
        h &&
        ((h.id ?? '').toLowerCase().includes('central') ||
          (h.name ?? '').toLowerCase().includes('central') ||
          (h.id ?? '').toLowerCase().includes('station')),
    );
    if (stationHub) return stationHub;
  }

  return null;
}

/** Matches a campus pickup/drop location against configured campus locations. */
export function matchCampusLocation(text: string, campusPlaces: Place[]): Place | null {
  const lower = text.toLowerCase();
  if (!Array.isArray(campusPlaces)) return null;

  // 1. Direct match on name, id, or normalized id
  for (const loc of campusPlaces) {
    if (!loc) continue;
    const nameLower = (loc.name ?? '').toLowerCase();
    const idNorm = (loc.id ?? '').toLowerCase().replace(/[-_]/g, ' ');
    if ((nameLower && lower.includes(nameLower)) || (idNorm && lower.includes(idNorm))) {
      return loc;
    }
  }

  // 2. Hall shorthand regex (e.g. "hall 7", "hall7", "h7", "hall-7")
  const hallMatch = lower.match(/\b(?:hall\s*|h)(\d{1,2})\b/);
  if (hallMatch && hallMatch[1]) {
    const hallNum = hallMatch[1];
    const targetHall = campusPlaces.find(
      (loc) =>
        loc &&
        ((loc.id ?? '').toLowerCase() === `hall-${hallNum}` ||
          (loc.name ?? '').toLowerCase() === `hall ${hallNum}` ||
          (loc.id ?? '').toLowerCase() === `hall${hallNum}`),
    );
    if (targetHall) return targetHall;
  }

  // 3. Gate
  if (lower.includes('main gate') || lower.includes('gate')) {
    const gateLoc = campusPlaces.find(
      (loc) => loc && ((loc.id ?? '').toLowerCase().includes('gate') || (loc.name ?? '').toLowerCase().includes('gate')),
    );
    if (gateLoc) return gateLoc;
  }

  return null;
}

/** Matches a vehicle type against configured vehicle types. */
export function matchVehicleType(text: string, vehicleTypes: VehicleType[]): VehicleType | null {
  const lower = text.toLowerCase();
  if (!Array.isArray(vehicleTypes)) return null;

  // 1. Direct match on name or id
  for (const v of vehicleTypes) {
    if (!v) continue;
    const nameLower = (v.name ?? '').toLowerCase();
    const idLower = (v.id ?? '').toLowerCase();
    if ((nameLower && lower.includes(nameLower)) || (idLower && lower.includes(idLower))) {
      return v;
    }
  }

  // 2. Vehicle synonyms
  for (const v of vehicleTypes) {
    if (!v) continue;
    const id = (v.id ?? '').toLowerCase();
    const name = (v.name ?? '').toLowerCase();

    // Car / Cab / Taxi / Sedan
    if (id.includes('car') || name.includes('car') || id.includes('cab')) {
      if (
        lower.includes('cab') ||
        lower.includes('car') ||
        lower.includes('taxi') ||
        lower.includes('sedan')
      ) {
        return v;
      }
    }

    // Auto / Rickshaw
    if (id.includes('auto') || name.includes('auto')) {
      if (
        lower.includes('auto') ||
        lower.includes('rickshaw') ||
        lower.includes('autorickshaw')
      ) {
        return v;
      }
    }

    // Vikram / Tempo
    if (id.includes('vikram') || name.includes('vikram')) {
      if (lower.includes('vikram') || lower.includes('tempo')) {
        return v;
      }
    }
  }

  return null;
}

/** Extract a ride UUID or numeric ID if mentioned in the text. */
function extractRideId(text: string): string | null {
  const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  const numMatch = text.match(/\bride\s*#?([0-9a-zA-Z_-]+)\b/i);
  if (numMatch && numMatch[1]) return numMatch[1];
  return null;
}

/** Check for prohibited transactional actions (FR-RD-05.4, AI-RD-05). */
function checkProhibitedAction(text: string): ChatbotResponse | null {
  const lower = text.toLowerCase();
  const rideId = extractRideId(lower);
  const targetRideHref = rideId ? routes.ride(rideId) : routes.findRide;

  // 1. Join ride
  if (
    lower.includes('join') ||
    lower.includes('book a seat') ||
    lower.includes('reserve a seat') ||
    lower.includes('request seat')
  ) {
    return {
      kind: 'prohibited_action',
      actionType: 'join',
      message:
        'I cannot submit, withdraw, or reconfirm join requests for you. Please use the ride details screen to request a seat directly.',
      targetLink: {
        href: targetRideHref,
        label: rideId ? `View Ride ${rideId}` : 'Browse Rides',
      },
    };
  }

  // 2. Withdraw / leave ride
  if (
    lower.includes('withdraw') ||
    lower.includes('cancel request') ||
    lower.includes('leave ride')
  ) {
    return {
      kind: 'prohibited_action',
      actionType: 'leave',
      message:
        'I cannot withdraw or cancel ride requests on your behalf. Please manage your seat directly on the ride screen.',
      targetLink: {
        href: targetRideHref,
        label: rideId ? `View Ride ${rideId}` : 'Your Rides',
      },
    };
  }

  // 3. Payment
  if (
    lower.includes('pay') ||
    lower.includes('payment') ||
    lower.includes('record payment') ||
    lower.includes('transfer fare')
  ) {
    return {
      kind: 'prohibited_action',
      actionType: 'pay',
      message:
        'I cannot record or process payments. Please coordinate and settle fare shares directly with your ride group on the ride screen.',
      targetLink: {
        href: targetRideHref,
        label: rideId ? `View Ride ${rideId}` : 'Your Rides',
      },
    };
  }

  // 4. Rating / review
  if (
    lower.includes('rate') ||
    lower.includes('review') ||
    lower.includes('stars') ||
    lower.includes('feedback')
  ) {
    return {
      kind: 'prohibited_action',
      actionType: 'rate',
      message:
        'I cannot submit ratings or reviews for you. You can rate the owner and co-riders on the review page after completing your ride.',
      targetLink: {
        href: rideId ? routes.rideReview(rideId) : routes.home,
        label: rideId ? `Rate Ride ${rideId}` : 'Your Rides',
      },
    };
  }

  // 5. Complaint
  if (
    lower.includes('complain') ||
    lower.includes('report rider') ||
    lower.includes('file a complaint') ||
    lower.includes('dispute')
  ) {
    return {
      kind: 'prohibited_action',
      actionType: 'complain',
      message:
        'I cannot submit complaints on your behalf. You can submit and track complaints on the dedicated complaints screen.',
      targetLink: {
        href: rideId ? routes.rideComplaint(rideId) : routes.myComplaints,
        label: rideId ? `File Complaint for Ride ${rideId}` : 'My Complaints',
      },
    };
  }

  // 6. Pool chat
  if (
    lower.includes('chat') ||
    lower.includes('send message') ||
    lower.includes('post in group') ||
    lower.includes('tell the group')
  ) {
    return {
      kind: 'prohibited_action',
      actionType: 'chat',
      message:
        'I cannot post messages in the pool chat. Please communicate with your co-riders directly using the in-app ride chat.',
      targetLink: {
        href: targetRideHref,
        label: rideId ? `Open Ride ${rideId} Chat` : 'Your Rides',
      },
    };
  }

  // 7. SOS
  if (
    lower.includes('sos') ||
    lower.includes('emergency') ||
    lower.includes('raise alert') ||
    lower.includes('call security')
  ) {
    return {
      kind: 'prohibited_action',
      actionType: 'sos',
      message:
        'I cannot raise or cancel SOS emergency alerts. In an emergency, please use the SOS button on your ride page immediately or contact campus security.',
      targetLink: {
        href: targetRideHref,
        label: rideId ? `Open Ride ${rideId} SOS` : 'Active Ride',
      },
    };
  }

  return null;
}

/** Check for out-of-scope queries (FR-RD-05.5, US-RD-12-AC2). */
function isOutOfScope(text: string): boolean {
  const lower = text.toLowerCase();
  const outOfScopePatterns = [
    /\b(homework|assignment|exam|quiz|grade|math|physics|chemistry|python|code|debug|function|essay|write a paper|capital of|recipe|weather in|who is the president|stock price)\b/i,
  ];

  const inScopeKeywords = [
    'ride',
    'carpool',
    'pool',
    'cab',
    'auto',
    'vikram',
    'station',
    'airport',
    'central',
    'pickup',
    'destination',
    'departure',
    'fare',
    'share',
    'driver',
    'owner',
    'rider',
    'tag',
    'preference',
    'hall',
    'gate',
    'profile',
    'rating',
    'timing',
    'iitk',
    'kanpur',
    'lucknow',
  ];

  const hasInScope = inScopeKeywords.some((kw) => lower.includes(kw));
  if (hasInScope) return false;

  return outOfScopePatterns.some((pattern) => pattern.test(lower));
}

/** Check for privacy probe (e.g. phone number or email) (US-RD-13-AC1, AI-RD-10). */
function checkPrivacyProbe(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('phone') ||
    lower.includes('mobile') ||
    lower.includes('number') ||
    lower.includes('contact') ||
    lower.includes('email') ||
    lower.includes('roll number') ||
    lower.includes('call')
  );
}

/** Extract a person's display name from query. */
function extractTargetName(text: string): string | null {
  const m = text.match(
    /(?:tell me about|about|who is|for|profile of)\s+(?:the\s+)?(?:rider|owner|driver|user)?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
  );
  if (m && m[1]) return m[1].replace(/^(?:rider|driver|owner|user)\s+/i, '').trim();

  const m2 = text.match(/(?:rider|driver|owner|user)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (m2 && m2[1]) return m2[1].trim();

  // Or "What is Aman's..." -> Aman
  const possessive = text.match(/\b([A-Za-z]+)'s\b/);
  if (possessive && possessive[1]) return possessive[1].trim();

  return null;
}

/** Check if rider is asking to change preferences (FR-RD-05.3, US-RD-14-AC1). */
function checkPreferenceChangeRequest(
  text: string,
  vehicleTypes: VehicleType[],
  campusPlaces: Place[],
): ProposedPreferenceChanges | null {
  const lower = text.toLowerCase();
  const isPrefChange =
    lower.includes('prefer') ||
    lower.includes('set my') ||
    lower.includes('change my') ||
    lower.includes('update my') ||
    lower.includes('default pickup') ||
    lower.includes('max fare') ||
    lower.includes('from now on');

  if (!isPrefChange) return null;

  const changes: ProposedPreferenceChanges = {};

  // Vehicle type
  const matchedVehicle = matchVehicleType(lower, vehicleTypes);
  if (matchedVehicle) {
    changes.preferredVehicleTypeId = matchedVehicle.id;
  }

  // Campus location
  const matchedCampus = matchCampusLocation(lower, campusPlaces);
  if (matchedCampus) {
    changes.defaultPickupPointId = matchedCampus.id;
  }

  // Max fare
  const fareMatch =
    lower.match(/(?:max(?:imum)?\s*(?:fare|share)?|₹|rs\.?)\s*(\d+)/i) ||
    lower.match(/(\d+)\s*(?:rupees|rs|inr)/i);
  if (fareMatch && fareMatch[1]) {
    const amount = Number(fareMatch[1]);
    if (amount > 0 && amount <= 50_000) {
      changes.maxAcceptableFareShare = amount;
    }
  }

  if (Object.keys(changes).length === 0) return null;
  return changes;
}

export const ASIA_KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30 (India Standard Time)

/**
 * Returns date components in Asia/Kolkata (IST, UTC+05:30) timezone.
 * Uses strict UTC arithmetic with the fixed 330-minute offset, guaranteeing
 * identical results regardless of the host system's process.env.TZ.
 */
export function getIstComponents(date: Date) {
  const istTime = new Date(date.getTime() + ASIA_KOLKATA_OFFSET_MS);
  return {
    year: istTime.getUTCFullYear(),
    month: istTime.getUTCMonth() + 1, // 1-12
    day: istTime.getUTCDate(),
    dayOfWeek: istTime.getUTCDay(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    hour: istTime.getUTCHours(),
    minute: istTime.getUTCMinutes(),
  };
}

/** Formats date components into an ISO 8601 string with explicit +05:30 offset. */
export function formatIstIsoString(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0,
  second: number = 0,
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+05:30`;
}

/**
 * Natural-language date and time extractor.
 * Converts references like "Saturday after 6 pm", "tomorrow 8am", etc. to an ISO window
 * constructed strictly in Asia/Kolkata (+05:30).
 */
export function extractDepartureWindow(
  text: string,
  now: Date,
): { departureStart: string; departureEnd: string } {
  const lower = text.toLowerCase();
  const istNow = getIstComponents(now);

  // Check days of week
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = days.findIndex((d) => lower.includes(d));

  let daysAhead = 0;
  if (dayIndex !== -1) {
    daysAhead = (dayIndex - istNow.dayOfWeek + 7) % 7;
    if (daysAhead === 0 && (lower.includes('next') || istNow.hour >= 20)) {
      daysAhead = 7;
    }
  } else if (lower.includes('tomorrow')) {
    daysAhead = 1;
  }

  // Calculate target date via UTC Date to avoid any host timezone shifts
  const targetUtc = new Date(Date.UTC(istNow.year, istNow.month - 1, istNow.day + daysAhead));
  const targetYear = targetUtc.getUTCFullYear();
  const targetMonth = targetUtc.getUTCMonth() + 1;
  const targetDay = targetUtc.getUTCDate();

  // Time extraction in IST
  let startHour = 8;
  let endHour = 12;

  if (
    lower.includes('after 6 pm') ||
    lower.includes('after 6pm') ||
    lower.includes('evening') ||
    lower.includes('night')
  ) {
    startHour = 18;
    endHour = 23;
  } else if (lower.includes('morning') || lower.includes('early')) {
    startHour = 6;
    endHour = 11;
  } else if (lower.includes('afternoon')) {
    startHour = 12;
    endHour = 17;
  } else {
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch && timeMatch[1]) {
      let h = Number(timeMatch[1]);
      const isPm = timeMatch[3]?.toLowerCase() === 'pm';
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      startHour = h;
      endHour = Math.min(23, h + 3);
    }
  }

  return {
    departureStart: formatIstIsoString(targetYear, targetMonth, targetDay, startHour, 0, 0),
    departureEnd: formatIstIsoString(targetYear, targetMonth, targetDay, endHour, 0, 0),
  };
}

/**
 * Main Chatbot entry point (Deliverable 1, UR-RD-05 / FR-RD-05).
 * Interprets messages, enforces security boundaries and permissions, and returns
 * structured, validated responses.
 */
export async function processChatbotMessage(
  viewerId: string,
  message: string,
  options?: ChatbotOptions,
): Promise<ChatbotResponse> {
  const now = options?.now ?? new Date();

  // AI-RD-08 / FR-RD-05.7: Graceful failure simulation / check
  if (options?.forceServiceFailure) {
    return {
      kind: 'service_unavailable',
      message:
        'The AI assistant is currently unavailable. You can search for rides using the standard manual search.',
      fallbackLink: {
        href: routes.findRide,
        label: 'Manual Ride Search',
      },
    };
  }

  if (!isUuid(viewerId)) {
    return {
      kind: 'service_unavailable',
      message: 'Authentication is required to use the assistant.',
      fallbackLink: { href: routes.login, label: 'Sign in' },
    };
  }

  // 1. Validate input length (AI-RD-09, US-RD-12-AC3)
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      kind: 'clarification',
      message: `Messages to the assistant cannot exceed ${MAX_MESSAGE_LENGTH} characters (your message is ${message.length} characters). Please shorten your query.`,
    };
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return {
      kind: 'clarification',
      message: 'Please send a message asking about rides, public profiles, or preferences.',
    };
  }

  // 2. Check for Prohibited Actions (FR-RD-05.4, US-RD-14-AC3, AI-RD-05)
  const prohibited = checkProhibitedAction(trimmed);
  if (prohibited) return prohibited;

  // 3. Check for Out-of-Scope Requests (FR-RD-05.5, US-RD-12-AC2)
  if (isOutOfScope(trimmed)) {
    return {
      kind: 'out_of_scope',
      message:
        'I can only assist with finding, comparing, and understanding campus rides and managing your ride preferences. Please use Find a Ride or Offer a Ride for platform features.',
    };
  }

  // 4. Check for Privacy Probes and Public Profile Inquiries (FR-RD-05.2, US-RD-13-AC1, AI-RD-10)
  const isProbe = checkPrivacyProbe(trimmed);
  const targetName = extractTargetName(trimmed);
  const isProfileQuery =
    Boolean(targetName) ||
    trimmed.toLowerCase().includes('profile') ||
    trimmed.toLowerCase().startsWith('tell me about') ||
    trimmed.toLowerCase().startsWith('who is');

  if (isProbe || targetName || isProfileQuery) {
    const profile = targetName
      ? await executeGetPublicProfile({ displayName: targetName }, now)
      : null;

    if (profile) {
      const privacyNotice = isProbe
        ? 'Contact details (phone numbers and emails) are strictly protected and never disclosed. All communication occurs via verified in-app pool chat. '
        : '';

      const ratingText = profile.aggregateRating
        ? `with an average rating of ${profile.aggregateRating.average} (${profile.aggregateRating.count} ratings)`
        : 'with no released ratings yet';

      const tagText =
        profile.visibleTags.length > 0
          ? `Visible interests: ${profile.visibleTags.join(', ')}.`
          : 'No public interest tags.';

      return {
        kind: 'public_profile',
        message: `${privacyNotice}${profile.displayName} has completed ${profile.completedTrips} trips ${ratingText}. ${tagText}`,
        profile,
      };
    } else if (isProbe) {
      return {
        kind: 'out_of_scope',
        message:
          'Contact details (phone numbers and emails) are private and never disclosed. You can interact with co-riders through in-app ride chat once joined.',
      };
    } else if (targetName) {
      return {
        kind: 'clarification',
        message: `I could not find a public profile for "${targetName}". Please check the spelling or ask about someone on your ride.`,
      };
    }
  }

  // Use configured options passed from server or default active options
  const configuredHubs = options?.rideOptions?.hubs?.length ? options.rideOptions.hubs : DEFAULT_HUBS;
  const configuredCampus = options?.rideOptions?.campusPlaces?.length ? options.rideOptions.campusPlaces : DEFAULT_CAMPUS_LOCATIONS;
  const configuredVehicles = options?.rideOptions?.vehicleTypes?.length ? options.rideOptions.vehicleTypes : DEFAULT_VEHICLE_TYPES;

  // 5. Check for Preference and Tag Changes (FR-RD-05.3, US-RD-14-AC1, AI-RD-04)
  const proposedChanges = checkPreferenceChangeRequest(trimmed, configuredVehicles, configuredCampus);
  if (proposedChanges) {
    try {
      const proposal = await executeProposePreferenceUpdate(viewerId, proposedChanges, now);
      return {
        kind: 'preference_proposal',
        message:
          'I have prepared your proposed preference update. This change requires your explicit confirmation and will lapse after 10 minutes if not confirmed.',
        proposal,
      };
    } catch (err) {
      return {
        kind: 'clarification',
        message: err instanceof Error ? err.message : 'Unable to propose preference update.',
      };
    }
  }

  // 6. Natural Language Ride Search (FR-RD-05.1, US-RD-12-AC1)
  const lower = trimmed.toLowerCase();

  // Resolve hub from configured active hubs (source of truth)
  const matchedHub = matchHub(lower, configuredHubs);

  if (!matchedHub) {
    return {
      kind: 'clarification',
      missingField: 'hub',
      message:
        'Where are you heading? Please specify a destination hub (such as Kanpur Central, Lucknow airport, Kanpur airport, Metro station, or Bus stand).',
    };
  }

  // Resolve direction
  const direction: 'to_hub' | 'from_hub' =
    lower.includes('from ' + matchedHub.name.toLowerCase()) ||
    lower.includes('from ' + matchedHub.id.toLowerCase().replace(/[-_]/g, ' ')) ||
    lower.includes('coming to campus') ||
    lower.includes('to campus')
      ? 'from_hub'
      : 'to_hub';

  // Resolve campus location (or default from rider preferences)
  const matchedCampus = matchCampusLocation(lower, configuredCampus);

  let defaultCampusId = configuredCampus[0]?.id ?? 'hall-1';
  let defaultCampusName = configuredCampus[0]?.name ?? 'Hall 1';

  try {
    const prefs = await executeGetRiderPreferences(viewerId);
    if (prefs?.defaultPickupPoint) {
      defaultCampusId = prefs.defaultPickupPoint.id;
      defaultCampusName = prefs.defaultPickupPoint.name;
    }
  } catch {}

  const campusLocationId = matchedCampus ? matchedCampus.id : defaultCampusId;
  const campusLocationName = matchedCampus ? matchedCampus.name : defaultCampusName;

  // Resolve vehicle from configured vehicle types
  const matchedVehicle = matchVehicleType(lower, configuredVehicles);

  // Resolve max fare
  let maxFareShare: number | undefined;
  const fareMatch = lower.match(/(?:max(?:imum)?\s*(?:fare|share)?|under|below|₹|rs\.?)\s*(\d+)/i);
  if (fareMatch && fareMatch[1]) {
    const f = Number(fareMatch[1]);
    if (f > 0 && f <= 50_000) maxFareShare = f;
  }

  // Resolve departure window (explicitly constructed in Asia/Kolkata)
  const { departureStart, departureEnd } = extractDepartureWindow(lower, now);

  const interpretedFilters: InterpretedFilters = {
    direction,
    hubId: matchedHub.id,
    hubName: matchedHub.name,
    campusLocationId,
    campusLocationName,
    departureStart,
    departureEnd,
    vehicleTypeId: matchedVehicle?.id,
    vehicleTypeName: matchedVehicle?.name,
    maxFareShare,
  };

  // Query matching rides using system's verified search rules
  const rides = await executeSearchRides(viewerId, {
    direction,
    hubId: matchedHub.id,
    campusLocationId,
    departureStart,
    departureEnd,
    vehicleTypeId: matchedVehicle?.id,
    maxFareShare,
  });

  const vehicleText = matchedVehicle ? ` in a ${matchedVehicle.name}` : '';
  const fareText = maxFareShare ? ` with share under ₹${maxFareShare}` : '';
  const resultCount = rides.length;
  const ridesText =
    resultCount === 0
      ? 'No open rides currently match these criteria.'
      : `Found ${resultCount} matching ${resultCount === 1 ? 'ride' : 'rides'}.`;

  const msg = `Showing rides for ${matchedHub.name} from ${campusLocationName}${vehicleText}${fareText}. ${ridesText}`;

  return {
    kind: 'search_results',
    message: msg,
    interpretedFilters,
    rides,
  };
}
