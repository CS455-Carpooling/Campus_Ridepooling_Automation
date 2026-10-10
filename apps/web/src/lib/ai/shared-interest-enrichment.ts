import "server-only";
import { pool } from "@/lib/db";

export type SharedInterestData = {
  /** Common visible tag labels safe to include in a model prompt, or null if unavailable. */
  sharedInterestTags: string[] | null;
};

type SharedInterestRow = {
  ride_id: string;
  all_participants_consented: boolean;
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
      viewer_tags AS (
        SELECT upt.tag_id
        FROM user_profile_tags upt
        JOIN interest_tags it ON it.id = upt.tag_id AND it.is_active = TRUE
        JOIN user_profiles up ON up.user_id = upt.user_id
        WHERE upt.user_id = $1::uuid
          AND up.ai_tag_consent = TRUE
          AND upt.is_visible = TRUE
      ),
      occupant_tags AS (
        SELECT DISTINCT p.ride_id, upt.tag_id
        FROM participants p
        JOIN user_profiles up ON up.user_id = p.user_id AND up.ai_tag_consent = TRUE
        JOIN user_profile_tags upt ON upt.user_id = p.user_id AND upt.is_visible = TRUE
        JOIN interest_tags it ON it.id = upt.tag_id AND it.is_active = TRUE
        WHERE p.user_id <> $1::uuid
      ),
      shared_tags AS (
        SELECT ot.ride_id, array_agg(DISTINCT it.name ORDER BY it.name) AS tag_names
        FROM occupant_tags ot
        JOIN viewer_tags vt ON vt.tag_id = ot.tag_id
        JOIN interest_tags it ON it.id = ot.tag_id AND it.is_active = TRUE
        GROUP BY ot.ride_id
      )
      SELECT
        cr.ride_id,
        COALESCE(c.all_participants_consented, FALSE)
          AND COALESCE(c.participant_count, 0) >= 2 AS all_participants_consented,
        st.tag_names AS shared_tag_names
      FROM candidate_rides cr
      LEFT JOIN consent c ON c.ride_id = cr.ride_id
      LEFT JOIN shared_tags st ON st.ride_id = cr.ride_id
    `,
    [requestingRiderId, [...new Set(candidateRideIds)]],
  );

  for (const row of rows) {
    const tags = row.all_participants_consented ? row.shared_tag_names : null;
    result.set(row.ride_id, {
      // No common visible labels is treated as unavailable, not as a negative
      // inference for the model to explain.
      sharedInterestTags: tags?.length ? tags : null,
    });
  }
  return result;
}
