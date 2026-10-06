import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { getProfileData } from '@/lib/profile-data';
type ProfileUpdate = {
  displayName: string;
  defaultPickupPointId: string;
  interestTags: Array<{ id: string; visible: boolean }>;
  preferredVehicleTypeId: string | null;
  maxAcceptableFareShare: number | null;
  aiTagConsent: boolean;
  mobileNumber: string | null;
};

function parseUpdate(body: Record<string, unknown>): ProfileUpdate | null {
  const displayName =
    typeof body.displayName === 'string' ? body.displayName.trim().replace(/\s+/g, ' ') : '';
  const defaultPickupPointId =
    typeof body.defaultPickupPointId === 'string' ? body.defaultPickupPointId : '';
  const preferredVehicleTypeId =
    body.preferredVehicleTypeId === null || body.preferredVehicleTypeId === ''
      ? null
      : typeof body.preferredVehicleTypeId === 'string'
        ? body.preferredVehicleTypeId
        : undefined;
  const fare = body.maxAcceptableFareShare;
  const maxAcceptableFareShare =
    fare === null || fare === '' ? null : typeof fare === 'number' ? fare : undefined;
  const mobile =
    body.mobileNumber === null || body.mobileNumber === ''
      ? null
      : typeof body.mobileNumber === 'string'
        ? body.mobileNumber
        : undefined;

  if (
    displayName.length < 2 ||
    displayName.length > 40 ||
    !defaultPickupPointId ||
    preferredVehicleTypeId === undefined ||
    (maxAcceptableFareShare !== null &&
      (maxAcceptableFareShare === undefined ||
        !Number.isSafeInteger(maxAcceptableFareShare) ||
        maxAcceptableFareShare < 1 ||
        maxAcceptableFareShare > 2_147_483_647)) ||
    mobile === undefined ||
    (mobile !== null && !/^\d{10}$/.test(mobile)) ||
    typeof body.aiTagConsent !== 'boolean' ||
    !Array.isArray(body.interestTags) ||
    body.interestTags.length > 10
  ) {
    return null;
  }

  const interestTags: Array<{ id: string; visible: boolean }> = [];
  const ids = new Set<string>();
  for (const value of body.interestTags) {
    if (
      !value ||
      typeof value !== 'object' ||
      !('id' in value) ||
      typeof value.id !== 'string' ||
      !value.id ||
      !('visible' in value) ||
      typeof value.visible !== 'boolean' ||
      ids.has(value.id)
    ) {
      return null;
    }
    ids.add(value.id);
    interestTags.push({ id: value.id, visible: value.visible });
  }

  return {
    displayName,
    defaultPickupPointId,
    interestTags,
    preferredVehicleTypeId,
    maxAcceptableFareShare,
    aiTagConsent: body.aiTagConsent,
    mobileNumber: mobile,
  };
}

async function rollback(client: PoolClient) {
  await client.query('ROLLBACK');
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const profile = await getProfileData(user.id);
  if (!profile) return json({ error: 'Profile is unavailable.' }, 404);
  return json({ profile });
}

export async function PUT(req: Request) {
  const blocked = await guard('profile-update', 20, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const update = parseUpdate(await readJson(req));
  if (!update) return json({ error: 'Please check the profile fields and try again.' }, 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [pickup, vehicle, tags] = await Promise.all([
      client.query(
        `SELECT id FROM locations WHERE id = $1 AND type = 'campus' AND is_active = true`,
        [update.defaultPickupPointId],
      ),
      update.preferredVehicleTypeId
        ? client.query('SELECT id FROM vehicle_types WHERE id = $1 AND is_active = true', [
            update.preferredVehicleTypeId,
          ])
        : Promise.resolve({ rows: [{ id: '' }] }),
      update.interestTags.length > 0
        ? client.query(
            'SELECT id FROM interest_tags WHERE id = ANY($1::text[]) AND is_active = true',
            [update.interestTags.map((tag) => tag.id)],
          )
        : Promise.resolve({ rows: [] }),
    ]);

    if (
      pickup.rows.length !== 1 ||
      vehicle.rows.length !== 1 ||
      tags.rows.length !== update.interestTags.length
    ) {
      await rollback(client);
      return json({ error: 'Choose an available pickup point, vehicle, and interest tags.' }, 400);
    }

    await client.query(
      `UPDATE user_profiles
       SET display_name = $2, default_pickup_point_id = $3,
           preferred_vehicle_type_id = $4, max_acceptable_fare_share = $5,
           ai_tag_consent = $6, mobile_number = $7, updated_at = now()
       WHERE user_id = $1`,
      [
        user.id,
        update.displayName,
        update.defaultPickupPointId,
        update.preferredVehicleTypeId,
        update.maxAcceptableFareShare,
        update.aiTagConsent,
        update.mobileNumber,
      ],
    );
    await client.query('DELETE FROM user_profile_tags WHERE user_id = $1', [user.id]);
    for (const tag of update.interestTags) {
      await client.query(
        `INSERT INTO user_profile_tags (user_id, tag_id, is_visible)
         VALUES ($1, $2, $3)`,
        [user.id, tag.id, tag.visible],
      );
    }

    await client.query('COMMIT');
    return json({ ok: true });
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}
