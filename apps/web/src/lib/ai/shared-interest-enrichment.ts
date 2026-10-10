import "server-only";
import { pool } from "@/lib/db";

export type SharedInterestData = {
  /** Common visible tag labels safe to include in a model prompt, or null if unavailable. */
  sharedInterestTags: string[] | null;
};

export function resolveSharedInterestTags(input: {
  allParticipantsConsented: boolean;
  allParticipantsHaveVisibleTags: boolean;
  sharedTagNames: readonly string[] | null;
}): string[] | null {
  if (!input.allParticipantsConsented || !input.allParticipantsHaveVisibleTags) return null;
  return [...new Set(input.sharedTagNames ?? [])].sort((a, b) => a.localeCompare(b));
}

type SharedInterestRow = {
  ride_id: string;
  all_participants_consented: boolean;
  all_participants_have_visible_tags: boolean;
  shared_tag_names: string[] | null;
};

/**
 * Builds privacy-filtered shared-interest data for candidate rides.
 *
 * Consent is required from the requesting rider and every current occupant
 * of a candidate ride. Only active, visible tags are considered. The query
 * returns labels only—never profile/user identifiers or per-person tag lists.
 * No shared labels, missing participants, or absent consent yields null.
 */
export async function enrichSharedInterests(
  requestingRiderId: string,
  candidateRideIds: readonly string[],
): Promise<Map<string, SharedInterestData>> {
  const result = new Map<string, SharedInterestData>();
  for (const rideId of candidateRideIds) result.set(rideId, { sharedInterestTags: null });
  if (!candidateRideIds.length) return result;

  const { rows } = await pool.query<SharedInterestRow>(
    `
      WITH candidate_rides AS (
        SELECT unnest($2::uuid[]) AS ride_id
      ),
      participants AS (
        SELECT cr.ride_id, $1::uuid AS user_id
        FROM candidate_rides cr
        UNION
        SELECT r.ride_id, r.user_id
        FROM riders r
        JOIN candidate_rides cr ON cr.ride_id = r.ride_id
        WHERE r.left_at IS NULL
      ),
      consent AS (
        SELECT
          p.ride_id,
          COUNT(*) = COUNT(up.user_id)
            AND bool_and(COALESCE(up.ai_tag_consent, FALSE)) AS all_participants_consented,
          COUNT(DISTINCT p.user_id) AS participant_count
        FROM participants p
        LEFT JOIN user_profiles up ON up.user_id = p.user_id
        GROUP BY p.ride_id
      ),
      visible_tags AS (
        SELECT DISTINCT p.ride_id, p.user_id, it.id AS tag_id, it.name AS tag_name
        FROM participants p
        JOIN user_profiles up ON up.user_id = p.user_id AND up.ai_tag_consent = TRUE
        JOIN user_profile_tags upt ON upt.user_id = p.user_id AND upt.is_visible = TRUE
        JOIN interest_tags it ON it.id = upt.tag_id AND it.is_active = TRUE
      ),
      usable_data AS (
        SELECT
          p.ride_id,
          COUNT(DISTINCT p.user_id) = COUNT(DISTINCT vt.user_id) AS all_participants_have_visible_tags
        FROM participants p
        LEFT JOIN visible_tags vt ON vt.ride_id = p.ride_id AND vt.user_id = p.user_id
        GROUP BY p.ride_id
      ),
      shared_tags AS (
        SELECT vt.ride_id, array_agg(vt.tag_name ORDER BY vt.tag_name) AS tag_names
        FROM visible_tags vt
        JOIN consent c ON c.ride_id = vt.ride_id
        WHERE c.participant_count >= 2
        GROUP BY vt.ride_id, vt.tag_id
        HAVING COUNT(DISTINCT vt.user_id) = MAX(c.participant_count)
      ),
      shared_tag_lists AS (
        SELECT ride_id, array_agg(tag_names[1] ORDER BY tag_names[1]) AS tag_names
        FROM shared_tags
        GROUP BY ride_id
      )
      SELECT
        cr.ride_id,
        COALESCE(c.all_participants_consented, FALSE)
          AND COALESCE(c.participant_count, 0) >= 2 AS all_participants_consented,
        COALESCE(ud.all_participants_have_visible_tags, FALSE) AS all_participants_have_visible_tags,
        st.tag_names AS shared_tag_names
      FROM candidate_rides cr
      LEFT JOIN consent c ON c.ride_id = cr.ride_id
      LEFT JOIN usable_data ud ON ud.ride_id = cr.ride_id
      LEFT JOIN shared_tag_lists st ON st.ride_id = cr.ride_id
    `,
    [requestingRiderId, [...new Set(candidateRideIds)]],
  );

  for (const row of rows) {
    result.set(row.ride_id, {
      sharedInterestTags: resolveSharedInterestTags({
        allParticipantsConsented: row.all_participants_consented,
        allParticipantsHaveVisibleTags: row.all_participants_have_visible_tags,
        sharedTagNames: row.shared_tag_names,
      }),
    });
  }
  return result;
}
