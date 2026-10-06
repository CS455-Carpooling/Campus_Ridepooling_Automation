import 'server-only';
import { pool } from './db';
import type { ProfileData, ProfileTag } from './profile-types';

type ProfileRow = {
  email: string;
  full_name: string;
  roll_number: string;
  display_name: string;
  default_pickup_point_id: string | null;
  preferred_vehicle_type_id: string | null;
  max_acceptable_fare_share: number | null;
  ai_tag_consent: boolean;
  mobile_number: string | null;
};

async function ensureProfile(userId: string) {
  await pool.query(
    `INSERT INTO user_profiles (user_id, display_name)
     SELECT id, CASE WHEN char_length(trim(full_name)) < 2 THEN 'User'
                     ELSE left(trim(full_name), 40) END
     FROM users WHERE id = $1
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

export async function getRideProfileDefaults(userId: string): Promise<{
  defaultPickupPointId: string | null;
  preferredVehicleTypeId: string | null;
}> {
  await ensureProfile(userId);
  const { rows } = await pool.query<{
    default_pickup_point_id: string | null;
    preferred_vehicle_type_id: string | null;
  }>(
    `SELECT default_pickup_point_id, preferred_vehicle_type_id
     FROM user_profiles WHERE user_id = $1`,
    [userId],
  );
  return {
    defaultPickupPointId: rows[0]?.default_pickup_point_id ?? null,
    preferredVehicleTypeId: rows[0]?.preferred_vehicle_type_id ?? null,
  };
}

export async function getProfileData(userId: string): Promise<ProfileData | null> {
  await ensureProfile(userId);

  const [profile, locations, vehicles, tags, completedTrips] = await Promise.all([
    pool.query<ProfileRow>(
      `SELECT u.email, u.full_name, u.roll_number, p.display_name,
              p.default_pickup_point_id, p.preferred_vehicle_type_id,
              p.max_acceptable_fare_share, p.ai_tag_consent, p.mobile_number
       FROM users u JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    ),
    pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM locations
       WHERE type = 'campus' AND is_active = true ORDER BY sort_order, name`,
    ),
    pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM vehicle_types WHERE is_active = true ORDER BY sort_order, name`,
    ),
    pool.query<ProfileTag>(
      `SELECT t.id, t.name, (upt.tag_id IS NOT NULL) AS selected,
              COALESCE(upt.is_visible, true) AS visible
       FROM interest_tags t
       LEFT JOIN user_profile_tags upt ON upt.tag_id = t.id AND upt.user_id = $1
       WHERE t.is_active = true
       ORDER BY t.name`,
      [userId],
    ),
    pool.query<{ count: string }>(
      `SELECT count(DISTINCT r.id)::text AS count
       FROM rides r
       JOIN riders m ON m.ride_id = r.id
       WHERE m.user_id = $1 AND r.state = 'completed'`,
      [userId],
    ),
  ]);

  const row = profile.rows[0];
  if (!row) return null;

  return {
    email: row.email,
    fullName: row.full_name,
    rollNumber: row.roll_number,
    displayName: row.display_name,
    defaultPickupPointId: row.default_pickup_point_id,
    preferredVehicleTypeId: row.preferred_vehicle_type_id,
    maxAcceptableFareShare: row.max_acceptable_fare_share,
    aiTagConsent: row.ai_tag_consent,
    mobileNumber: row.mobile_number,
    locations: locations.rows,
    vehicles: vehicles.rows,
    tags: tags.rows,
    completedTrips: Number(completedTrips.rows[0]?.count ?? 0),
    rating: null,
  };
}
