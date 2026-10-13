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
};

const HUBS = [
  {
    id: 'kanpur-central',
    name: 'Kanpur Central',
    keywords: [
      'kanpur central',
      'central station',
      'railway station',
      'train station',
      'station',
      'central',
    ],
  },
  {
    id: 'lucknow-airport',
    name: 'Lucknow airport',
    keywords: ['lucknow airport', 'lucknow', 'ccsi', 'amausi'],
  },
  { id: 'kanpur-airport', name: 'Kanpur airport', keywords: ['kanpur airport', 'chakeri'] },
  {
    id: 'bus-stand',
    name: 'Bus stand',
    keywords: ['bus stand', 'bus station', 'jhakarkati', 'bus'],
  },
  {
    id: 'metro-station',
    name: 'Metro station',
    keywords: ['metro station', 'metro', 'iitk metro'],
  },
  { id: 'kanpur-anwarganj', name: 'Kanpur Anwarganj', keywords: ['anwarganj'] },
];

const CAMPUS_LOCATIONS = [
  { id: 'hall-1', name: 'Hall 1', keywords: ['hall 1', 'hall1', 'h1'] },
  { id: 'hall-2', name: 'Hall 2', keywords: ['hall 2', 'hall2', 'h2'] },
  { id: 'hall-3', name: 'Hall 3', keywords: ['hall 3', 'hall3', 'h3'] },
  { id: 'hall-4', name: 'Hall 4', keywords: ['hall 4', 'hall4', 'h4'] },
  { id: 'hall-5', name: 'Hall 5', keywords: ['hall 5', 'hall5', 'h5'] },
  { id: 'hall-6', name: 'Hall 6', keywords: ['hall 6', 'hall6', 'h6'] },
  { id: 'hall-7', name: 'Hall 7', keywords: ['hall 7', 'hall7', 'h7'] },
  { id: 'hall-8', name: 'Hall 8', keywords: ['hall 8', 'hall8', 'h8'] },
  { id: 'hall-9', name: 'Hall 9', keywords: ['hall 9', 'hall9', 'h9'] },
  { id: 'hall-10', name: 'Hall 10', keywords: ['hall 10', 'hall10', 'h10'] },
  { id: 'hall-11', name: 'Hall 11', keywords: ['hall 11', 'hall11', 'h11'] },
  { id: 'hall-12', name: 'Hall 12', keywords: ['hall 12', 'hall12', 'h12'] },
  { id: 'hall-13', name: 'Hall 13', keywords: ['hall 13', 'hall13', 'h13'] },
  { id: 'hall-14', name: 'Hall 14', keywords: ['hall 14', 'hall14', 'h14'] },
  { id: 'main-gate', name: 'Main Gate', keywords: ['main gate', 'gate'] },
];

const VEHICLE_TYPES = [
  { id: 'auto', name: 'Auto', keywords: ['auto', 'autorickshaw', 'rickshaw'] },
  { id: 'car', name: 'Car', keywords: ['cab', 'car', 'taxi', 'sedan'] },
  { id: 'vikram', name: 'Vikram', keywords: ['vikram', 'tempo'] },
];

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
function checkPreferenceChangeRequest(text: string): ProposedPreferenceChanges | null {
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
  for (const v of VEHICLE_TYPES) {
    if (v.keywords.some((k) => lower.includes(k))) {
      changes.preferredVehicleTypeId = v.id;
      break;
    }
  }

  // Campus location
  for (const loc of CAMPUS_LOCATIONS) {
    if (loc.keywords.some((k) => lower.includes(k))) {
      changes.defaultPickupPointId = loc.id;
      break;
    }
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

/**
 * Natural-language date and time extractor.
 * Converts references like "Saturday after 6 pm", "tomorrow 8am", etc. to an ISO window.
 */
function extractDepartureWindow(text: string, now: Date): { start: Date; end: Date } {
  const lower = text.toLowerCase();
  const date = new Date(now.getTime());

  // Check days of week
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = days.findIndex((d) => lower.includes(d));

  if (dayIndex !== -1) {
    const currentDay = date.getDay();
    let daysAhead = (dayIndex - currentDay + 7) % 7;
    if (daysAhead === 0 && (lower.includes('next') || date.getHours() >= 20)) {
      daysAhead = 7;
    }
    date.setDate(date.getDate() + daysAhead);
  } else if (lower.includes('tomorrow')) {
    date.setDate(date.getDate() + 1);
  }

  // Time extraction
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

  const startDate = new Date(date);
  startDate.setHours(startHour, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(endHour, 0, 0, 0);

  return { start: startDate, end: endDate };
}

/** Formats date to ISO string with Indian Standard Time (+05:30) offset. */
function toIsoWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Represent explicitly in IST
  const offsetMinutes = 330; // +05:30
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000;
  const ist = new Date(utc + offsetMinutes * 60_000);

  const Y = ist.getFullYear();
  const M = pad(ist.getMonth() + 1);
  const D = pad(ist.getDate());
  const h = pad(ist.getHours());
  const m = pad(ist.getMinutes());
  const s = pad(ist.getSeconds());
  return `${Y}-${M}-${D}T${h}:${m}:${s}+05:30`;
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

  // 5. Check for Preference and Tag Changes (FR-RD-05.3, US-RD-14-AC1, AI-RD-04)
  const proposedChanges = checkPreferenceChangeRequest(trimmed);
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

  // Resolve hub
  let matchedHub = HUBS.find((h) => h.keywords.some((k) => lower.includes(k)));
  // Default to Kanpur Central if generic "station" or "train", or airport
  if (!matchedHub) {
    if (lower.includes('airport')) {
      matchedHub = HUBS.find((h) => h.id === 'lucknow-airport');
    }
  }

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
    lower.includes('from ' + matchedHub.keywords[0]) ||
    lower.includes('coming to campus') ||
    lower.includes('to campus')
      ? 'from_hub'
      : 'to_hub';

  // Resolve campus location (or default from rider preferences)
  let matchedCampus = CAMPUS_LOCATIONS.find((loc) => loc.keywords.some((k) => lower.includes(k)));

  let defaultCampusId = 'hall-1';
  let defaultCampusName = 'Hall 1';

  try {
    const prefs = await executeGetRiderPreferences(viewerId);
    if (prefs?.defaultPickupPoint) {
      defaultCampusId = prefs.defaultPickupPoint.id;
      defaultCampusName = prefs.defaultPickupPoint.name;
    }
  } catch {}

  const campusLocationId = matchedCampus ? matchedCampus.id : defaultCampusId;
  const campusLocationName = matchedCampus ? matchedCampus.name : defaultCampusName;

  // Resolve vehicle
  const matchedVehicle = VEHICLE_TYPES.find((v) => v.keywords.some((k) => lower.includes(k)));

  // Resolve max fare
  let maxFareShare: number | undefined;
  const fareMatch = lower.match(/(?:max(?:imum)?\s*(?:fare|share)?|under|below|₹|rs\.?)\s*(\d+)/i);
  if (fareMatch && fareMatch[1]) {
    const f = Number(fareMatch[1]);
    if (f > 0 && f <= 50_000) maxFareShare = f;
  }

  // Resolve departure window
  const { start, end } = extractDepartureWindow(lower, now);
  const departureStart = toIsoWithOffset(start);
  const departureEnd = toIsoWithOffset(end);

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
