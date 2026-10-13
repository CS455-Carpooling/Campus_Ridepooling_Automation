import 'server-only';
import { pool } from '../db';
import { estimateShare } from '../fare';
import { isUuid } from '../ids';
import { publicRatingJoin } from '../rating-summary';
import { RATING_RULES } from '../rating-rules';
import { searchRides, type SearchRideRequest, type SearchRideResult } from '../ride-search';
import { parseSearchRequest } from '../ride-search-rules';
import { getRideView, type RideView } from '../ride-view';
import {
  createPreferenceProposal,
  type PreferenceProposal,
  type ProposedPreferenceChanges,
} from './preference-proposals';

/**
 * The strict server-side allowlist of tools the AI agent may invoke (AI-RD-02, Deliverable 1 §2).
 * Under AI-RD-05, no tool exists for any transactional or state-changing action.
 */
export const ALLOWED_CHATBOT_TOOLS = [
  'search_rides',
  'get_ride_details',
  'get_fare_estimate',
  'get_public_profile',
  'get_rider_preferences',
  'propose_preference_update',
] as const;

export type ChatbotToolName = (typeof ALLOWED_CHATBOT_TOOLS)[number];

export const PROHIBITED_CHATBOT_ACTIONS = [
  'join_ride',
  'withdraw_join_request',
  'reconfirm_join_request',
  'record_payment',
  'submit_rating',
  'submit_complaint',
  'post_chat_message',
  'raise_sos',
  'cancel_sos',
  'modify_ride',
  'cancel_ride',
] as const;

export function isAllowedChatbotTool(name: string): name is ChatbotToolName {
  return (ALLOWED_CHATBOT_TOOLS as readonly string[]).includes(name);
}

export type PublicProfileResult = {
  displayName: string;
  visibleTags: string[];
  completedTrips: number;
  aggregateRating: {
    average: number | null;
    count: number;
  } | null;
};

export type PublicRideDetailsResult = {
  rideId: string;
  direction: 'to_hub' | 'from_hub';
  departureStart: string;
  departureEnd: string;
  seatsLeft: number;
  capacity: number;
  vehicleName: string;
  totalFare: number;
  estimatedShare: number;
  owner: {
    name: string;
    rating: { average: number | null; count: number } | null;
  };
  occupants: Array<{
    name: string;
    campusPlace: string;
    visibleTags: string[];
    completedTrips: number;
    rating: { average: number | null; count: number } | null;
  }>;
  itinerary: unknown;
};

export type RiderPreferencesResult = {
  defaultPickupPoint: { id: string; name: string } | null;
  preferredVehicleType: { id: string; name: string } | null;
  maxAcceptableFareShare: number | null;
  aiTagConsent: boolean;
  interestTags: Array<{ id: string; name: string; visible: boolean }>;
};

export type ChatbotToolResult =
  | { success: true; tool: 'search_rides'; data: SearchRideResult[] }
  | { success: true; tool: 'get_ride_details'; data: PublicRideDetailsResult | null }
  | {
      success: true;
      tool: 'get_fare_estimate';
      data: { estimatedShare: number; totalFare: number; occupants: number };
    }
  | { success: true; tool: 'get_public_profile'; data: PublicProfileResult | null }
  | { success: true; tool: 'get_rider_preferences'; data: RiderPreferencesResult }
  | { success: true; tool: 'propose_preference_update'; data: PreferenceProposal }
  | { success: false; tool: string; error: string; isProhibited?: boolean };

/**
 * 1. search_rides (FR-RD-03.2, AI-RD-02)
 * Searches open, eligible rides using the system's verified search rules.
 */
export async function executeSearchRides(
  viewerId: string,
  args: unknown,
): Promise<SearchRideResult[]> {
  if (!isUuid(viewerId)) return [];
  if (!args || typeof args !== 'object') return [];

  const parsed = parseSearchRequest(args as Record<string, string | string[] | undefined>);
  if (!parsed) return [];

  return searchRides(viewerId, parsed);
}

/**
 * 2. get_ride_details (FR-RD-03.6, AI-RD-02, AI-RD-05)
 * Returns public ride details only. Emails, phone numbers, roll numbers and private notes
 * are never included.
 */
export async function executeGetRideDetails(
  viewerId: string,
  args: unknown,
  now: Date = new Date(),
): Promise<PublicRideDetailsResult | null> {
  if (!isUuid(viewerId) || !args || typeof args !== 'object') return null;

  const rideId =
    typeof (args as { rideId?: unknown }).rideId === 'string'
      ? (args as { rideId: string }).rideId.trim()
      : '';

  if (!isUuid(rideId)) return null;

  const view = (await getRideView(rideId, viewerId, now)) as any;
  if (!view) return null;

  const ownerOccupant = view.occupants?.find((o: any) => o.isOwner);
  const ownerName = view.ownerName ?? ownerOccupant?.name ?? 'Ride Owner';
  const ownerRating = view.ownerRating ?? ownerOccupant?.rating ?? null;

  return {
    rideId: view.rideId ?? view.id,
    direction: view.direction,
    departureStart: view.departureStart,
    departureEnd: view.departureEnd,
    seatsLeft: view.seatsLeft,
    capacity: view.capacity,
    vehicleName: view.vehicleName,
    totalFare: view.totalFare,
    estimatedShare: view.estimatedShare ?? 0,
    owner: {
      name: ownerName,
      rating: ownerRating,
    },
    occupants: (view.occupants || []).map((occ: any) => ({
      name: occ.name,
      campusPlace: occ.campusPlace,
      visibleTags: occ.visibleTags,
      completedTrips: occ.completedTrips,
      rating: occ.rating,
    })),
    itinerary: view.itinerary ?? view.trip?.stops ?? null,
  };
}

/**
 * 3. get_fare_estimate (FR-RD-08.1, AI-RD-02)
 * Computes estimated share in whole rupees (totalFare / (occupants + 1), rounded up).
 */
export async function executeGetFareEstimate(
  args: unknown,
): Promise<{ estimatedShare: number; totalFare: number; occupants: number } | null> {
  if (!args || typeof args !== 'object') return null;

  const { totalFare, currentOccupants } = args as {
    totalFare?: unknown;
    currentOccupants?: unknown;
  };

  const total =
    typeof totalFare === 'number' && Number.isSafeInteger(totalFare) && totalFare >= 0
      ? totalFare
      : null;
  const occupants =
    typeof currentOccupants === 'number' &&
    Number.isSafeInteger(currentOccupants) &&
    currentOccupants >= 0
      ? currentOccupants
      : null;

  if (total === null || occupants === null) return null;

  const estimatedShare = estimateShare(total, occupants);
  return {
    estimatedShare,
    totalFare: total,
    occupants,
  };
}

/**
 * 4. get_public_profile (FR-RD-02.4, FR-RD-05.2, AI-RD-10)
 * Queries only explicitly permitted public profile fields of an owner or co-rider:
 * - display name
 * - visible tags
 * - completed trip count
 * - aggregate rating (only if count >= 3, per P-24 / FR-RD-12.3)
 * Email, mobile number, roll number and unconsented tags are NEVER returned.
 */
export async function executeGetPublicProfile(
  args: unknown,
  now: Date = new Date(),
): Promise<PublicProfileResult | null> {
  if (!args || typeof args !== 'object') return null;

  const { userId, displayName } = args as { userId?: unknown; displayName?: unknown };
  const rawUserId = typeof userId === 'string' ? userId.trim() : '';
  const rawDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

  if (!rawUserId && !rawDisplayName) return null;
  if (rawUserId && !isUuid(rawUserId)) return null;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (rawUserId) {
    params.push(rawUserId);
    conditions.push(`u.id = $${params.length}`);
  } else if (rawDisplayName) {
    params.push(rawDisplayName);
    conditions.push(
      `(lower(COALESCE(p.display_name, u.full_name)) = lower($${params.length}) OR lower(u.full_name) = lower($${params.length}))`,
    );
  }

  params.push(now);
  const nowParam = `$${params.length}`;

  const query = `
    SELECT COALESCE(p.display_name, u.full_name) AS display_name,
           COALESCE(public_tags.visible_tags, ARRAY[]::text[]) AS visible_tags,
           (SELECT count(DISTINCT completed.ride_id)::int
            FROM riders completed
            JOIN rides completed_ride ON completed_ride.id = completed.ride_id
            WHERE completed.user_id = u.id AND completed.left_at IS NULL
              AND completed_ride.state = 'completed') AS completed_trips,
           public_rating.rating_count, public_rating.rating_average
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT array_agg(tag.name ORDER BY tag.name) AS visible_tags
      FROM user_profile_tags selected
      JOIN interest_tags tag ON tag.id = selected.tag_id AND tag.is_active = true
      WHERE selected.user_id = u.id AND selected.is_visible = true
    ) public_tags ON true
    ${publicRatingJoin('u.id', nowParam)}
    WHERE ${conditions.join(' AND ')}
    LIMIT 1`;

  const { rows } = await pool.query<{
    display_name: string;
    visible_tags: string[];
    completed_trips: number;
    rating_count: number | null;
    rating_average: number | null;
  }>(query, params);

  const row = rows[0];
  if (!row) return null;

  const ratingCount = row.rating_count ?? 0;
  const ratingAverage = row.rating_average ?? null;

  return {
    displayName: row.display_name,
    visibleTags: row.visible_tags ?? [],
    completedTrips: row.completed_trips ?? 0,
    aggregateRating:
      ratingCount >= RATING_RULES.minRatingsToShow && ratingAverage !== null
        ? { average: ratingAverage, count: ratingCount }
        : null,
  };
}

/**
 * 5. get_rider_preferences (AI-RD-02, AI-RD-10)
 * Returns the requesting rider's preferences. Tags are included ONLY if aiTagConsent is true.
 * Phone number and roll number are never included.
 */
export async function executeGetRiderPreferences(
  viewerId: string,
): Promise<RiderPreferencesResult | null> {
  if (!isUuid(viewerId)) return null;

  const { rows } = await pool.query<{
    pickup_id: string | null;
    pickup_name: string | null;
    vehicle_id: string | null;
    vehicle_name: string | null;
    max_share: number | null;
    ai_tag_consent: boolean;
  }>(
    `SELECT p.default_pickup_point_id AS pickup_id, loc.name AS pickup_name,
            p.preferred_vehicle_type_id AS vehicle_id, vt.name AS vehicle_name,
            p.max_acceptable_fare_share AS max_share,
            p.ai_tag_consent
     FROM user_profiles p
     LEFT JOIN locations loc ON loc.id = p.default_pickup_point_id
     LEFT JOIN vehicle_types vt ON vt.id = p.preferred_vehicle_type_id
     WHERE p.user_id = $1`,
    [viewerId],
  );

  const p = rows[0];
  if (!p) return null;

  let tags: Array<{ id: string; name: string; visible: boolean }> = [];
  // AI-RD-10 / FR-RD-16.2: tags are only sent if the rider consented
  if (p.ai_tag_consent) {
    const tagsResult = await pool.query<{ id: string; name: string; is_visible: boolean }>(
      `SELECT t.id, t.name, upt.is_visible
       FROM user_profile_tags upt
       JOIN interest_tags t ON t.id = upt.tag_id AND t.is_active = true
       WHERE upt.user_id = $1
       ORDER BY t.name`,
      [viewerId],
    );
    tags = tagsResult.rows.map((t) => ({
      id: t.id,
      name: t.name,
      visible: t.is_visible,
    }));
  }

  return {
    defaultPickupPoint:
      p.pickup_id && p.pickup_name ? { id: p.pickup_id, name: p.pickup_name } : null,
    preferredVehicleType:
      p.vehicle_id && p.vehicle_name ? { id: p.vehicle_id, name: p.vehicle_name } : null,
    maxAcceptableFareShare: p.max_share,
    aiTagConsent: p.ai_tag_consent,
    interestTags: tags,
  };
}

/**
 * 6. propose_preference_update (FR-RD-05.3, AI-RD-04)
 * Creates an unconfirmed preference proposal with a 10-minute expiry.
 * Does NOT modify user_profiles.
 */
export async function executeProposePreferenceUpdate(
  viewerId: string,
  args: unknown,
  now: Date = new Date(),
): Promise<PreferenceProposal> {
  if (!isUuid(viewerId)) throw new Error('Invalid user ID.');
  if (!args || typeof args !== 'object') throw new Error('Invalid proposal arguments.');

  const changes = args as ProposedPreferenceChanges;
  return createPreferenceProposal(viewerId, changes, now);
}

/**
 * Central tool executor enforcing the server-side tool allowlist (AI-RD-02, AI-RD-05).
 * Strictly rejects any unlisted or prohibited action without invoking tools.
 */
export async function executeChatbotTool(
  viewerId: string,
  toolName: string,
  args: unknown,
  options?: { now?: Date },
): Promise<ChatbotToolResult> {
  const now = options?.now ?? new Date();

  if (!isAllowedChatbotTool(toolName)) {
    return {
      success: false,
      tool: toolName,
      error: `Prohibited action: "${toolName}" is not permitted. The assistant cannot perform transactional actions.`,
      isProhibited: true,
    };
  }

  try {
    switch (toolName) {
      case 'search_rides': {
        const data = await executeSearchRides(viewerId, args);
        return { success: true, tool: 'search_rides', data };
      }
      case 'get_ride_details': {
        const data = await executeGetRideDetails(viewerId, args, now);
        return { success: true, tool: 'get_ride_details', data };
      }
      case 'get_fare_estimate': {
        const data = await executeGetFareEstimate(args);
        if (!data)
          return { success: false, tool: 'get_fare_estimate', error: 'Invalid fare parameters.' };
        return { success: true, tool: 'get_fare_estimate', data };
      }
      case 'get_public_profile': {
        const data = await executeGetPublicProfile(args, now);
        return { success: true, tool: 'get_public_profile', data };
      }
      case 'get_rider_preferences': {
        const data = await executeGetRiderPreferences(viewerId);
        if (!data)
          return { success: false, tool: 'get_rider_preferences', error: 'Profile not found.' };
        return { success: true, tool: 'get_rider_preferences', data };
      }
      case 'propose_preference_update': {
        const data = await executeProposePreferenceUpdate(viewerId, args, now);
        return { success: true, tool: 'propose_preference_update', data };
      }
    }
  } catch (error) {
    return {
      success: false,
      tool: toolName,
      error: error instanceof Error ? error.message : 'Tool execution failed.',
    };
  }
}
