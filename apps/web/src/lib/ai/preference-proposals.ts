import 'server-only';
import { randomUUID } from 'node:crypto';
import { pool } from '../db';
import { isUuid } from '../ids';
import { RIDE_RULES } from '../ride-rules';

export const PROPOSAL_TTL_MS = 10 * 60 * 1_000; // 10 minutes (FR-RD-05.3, AI-RD-04)

export type PreferenceSnapshot = {
  defaultPickupPoint: { id: string; name: string } | null;
  preferredVehicleType: { id: string; name: string } | null;
  maxAcceptableFareShare: number | null;
  interestTags: Array<{ id: string; name: string; visible: boolean }>;
};

export type ProposedPreferenceChanges = {
  defaultPickupPointId?: string;
  preferredVehicleTypeId?: string | null;
  maxAcceptableFareShare?: number | null;
  interestTags?: Array<{ id: string; visible: boolean }>;
};

export type PreferenceProposal = {
  id: string;
  userId: string;
  before: PreferenceSnapshot;
  after: PreferenceSnapshot;
  changes: ProposedPreferenceChanges;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  expiresAt: string;
  createdAt: string;
};

/** Load the current snapshot of user preferences for before/after comparison. */
export async function getPreferenceSnapshot(userId: string): Promise<PreferenceSnapshot> {
  const [profileResult, tagsResult] = await Promise.all([
    pool.query<{
      pickup_id: string | null;
      pickup_name: string | null;
      vehicle_id: string | null;
      vehicle_name: string | null;
      max_share: number | null;
    }>(
      `SELECT p.default_pickup_point_id AS pickup_id, loc.name AS pickup_name,
              p.preferred_vehicle_type_id AS vehicle_id, vt.name AS vehicle_name,
              p.max_acceptable_fare_share AS max_share
       FROM user_profiles p
       LEFT JOIN locations loc ON loc.id = p.default_pickup_point_id
       LEFT JOIN vehicle_types vt ON vt.id = p.preferred_vehicle_type_id
       WHERE p.user_id = $1`,
      [userId],
    ),
    pool.query<{ id: string; name: string; is_visible: boolean }>(
      `SELECT t.id, t.name, upt.is_visible
       FROM user_profile_tags upt
       JOIN interest_tags t ON t.id = upt.tag_id AND t.is_active = true
       WHERE upt.user_id = $1
       ORDER BY t.name`,
      [userId],
    ),
  ]);

  const p = profileResult.rows[0];
  return {
    defaultPickupPoint:
      p?.pickup_id && p?.pickup_name ? { id: p.pickup_id, name: p.pickup_name } : null,
    preferredVehicleType:
      p?.vehicle_id && p?.vehicle_name ? { id: p.vehicle_id, name: p.vehicle_name } : null,
    maxAcceptableFareShare: p?.max_share ?? null,
    interestTags: tagsResult.rows.map((t) => ({
      id: t.id,
      name: t.name,
      visible: t.is_visible,
    })),
  };
}

/**
 * Creates a preference proposal (FR-RD-05.3, AI-RD-04).
 * The proposal is stored with a 10-minute expiry and does not take effect until
 * the rider explicitly confirms it.
 */
export async function createPreferenceProposal(
  userId: string,
  changes: ProposedPreferenceChanges,
  now: Date = new Date(),
): Promise<PreferenceProposal> {
  if (!isUuid(userId)) throw new Error('Invalid user ID.');

  // Validate changes
  if (changes.defaultPickupPointId) {
    const { rows } = await pool.query(
      `SELECT id FROM locations WHERE id = $1 AND type = 'campus' AND is_active = true`,
      [changes.defaultPickupPointId],
    );
    if (rows.length === 0) throw new Error('Unknown or inactive campus pickup location.');
  }

  if (changes.preferredVehicleTypeId !== undefined && changes.preferredVehicleTypeId !== null) {
    const { rows } = await pool.query(
      `SELECT id FROM vehicle_types WHERE id = $1 AND is_active = true`,
      [changes.preferredVehicleTypeId],
    );
    if (rows.length === 0) throw new Error('Unknown or inactive vehicle type.');
  }

  if (changes.maxAcceptableFareShare !== undefined && changes.maxAcceptableFareShare !== null) {
    if (
      !Number.isInteger(changes.maxAcceptableFareShare) ||
      changes.maxAcceptableFareShare < 1 ||
      changes.maxAcceptableFareShare > RIDE_RULES.maxFare
    ) {
      throw new Error(`Max fare share must be between ₹1 and ₹${RIDE_RULES.maxFare}.`);
    }
  }

  if (changes.interestTags) {
    if (!Array.isArray(changes.interestTags) || changes.interestTags.length > 10) {
      throw new Error('At most 10 interest tags allowed.');
    }
    const tagIds = changes.interestTags.map((t) => t.id);
    if (tagIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT id FROM interest_tags WHERE id = ANY($1::text[]) AND is_active = true`,
        [tagIds],
      );
      if (rows.length !== tagIds.length) {
        throw new Error('One or more interest tags are invalid or inactive.');
      }
    }
  }

  const before = await getPreferenceSnapshot(userId);

  // Compute what the snapshot would be after applying
  let afterPickup = before.defaultPickupPoint;
  if (changes.defaultPickupPointId !== undefined) {
    const { rows } = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM locations WHERE id = $1`,
      [changes.defaultPickupPointId],
    );
    afterPickup = rows[0] ? { id: rows[0].id, name: rows[0].name } : null;
  }

  let afterVehicle = before.preferredVehicleType;
  if (changes.preferredVehicleTypeId !== undefined) {
    if (changes.preferredVehicleTypeId === null) {
      afterVehicle = null;
    } else {
      const { rows } = await pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM vehicle_types WHERE id = $1`,
        [changes.preferredVehicleTypeId],
      );
      afterVehicle = rows[0] ? { id: rows[0].id, name: rows[0].name } : null;
    }
  }

  const afterMaxShare =
    changes.maxAcceptableFareShare !== undefined
      ? changes.maxAcceptableFareShare
      : before.maxAcceptableFareShare;

  let afterTags = before.interestTags;
  if (changes.interestTags !== undefined) {
    const tagIds = changes.interestTags.map((t) => t.id);
    if (tagIds.length === 0) {
      afterTags = [];
    } else {
      const { rows } = await pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM interest_tags WHERE id = ANY($1::text[]) ORDER BY name`,
        [tagIds],
      );
      const tagMap = new Map(rows.map((r) => [r.id, r.name]));
      afterTags = changes.interestTags.map((t) => ({
        id: t.id,
        name: tagMap.get(t.id) ?? t.id,
        visible: t.visible,
      }));
    }
  }

  const after: PreferenceSnapshot = {
    defaultPickupPoint: afterPickup,
    preferredVehicleType: afterVehicle,
    maxAcceptableFareShare: afterMaxShare,
    interestTags: afterTags,
  };

  const proposalId = randomUUID();
  const expiresAt = new Date(now.getTime() + PROPOSAL_TTL_MS);

  await pool.query(
    `INSERT INTO chatbot_preference_proposals
       (id, user_id, before_snapshot, proposed_changes, status, expires_at, created_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
    [proposalId, userId, JSON.stringify(before), JSON.stringify(changes), expiresAt, now],
  );

  return {
    id: proposalId,
    userId,
    before,
    after,
    changes,
    status: 'pending',
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };
}

/**
 * Retrieves a preference proposal and verifies whether it has expired.
 */
export async function getPreferenceProposal(
  proposalId: string,
  userId: string,
  now: Date = new Date(),
): Promise<PreferenceProposal | null> {
  if (!isUuid(proposalId) || !isUuid(userId)) return null;

  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    before_snapshot: PreferenceSnapshot;
    proposed_changes: ProposedPreferenceChanges;
    status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
    expires_at: Date;
    created_at: Date;
  }>(
    `SELECT id, user_id, before_snapshot, proposed_changes, status, expires_at, created_at
     FROM chatbot_preference_proposals
     WHERE id = $1 AND user_id = $2`,
    [proposalId, userId],
  );

  const row = rows[0];
  if (!row) return null;

  let currentStatus = row.status;
  if (currentStatus === 'pending' && row.expires_at <= now) {
    currentStatus = 'expired';
    await pool.query(`UPDATE chatbot_preference_proposals SET status = 'expired' WHERE id = $1`, [
      proposalId,
    ]);
  }

  const before =
    typeof row.before_snapshot === 'string' ? JSON.parse(row.before_snapshot) : row.before_snapshot;
  const changes =
    typeof row.proposed_changes === 'string'
      ? JSON.parse(row.proposed_changes)
      : row.proposed_changes;

  // Reconstruct after snapshot
  const afterPickup =
    changes.defaultPickupPointId !== undefined
      ? changes.defaultPickupPointId
        ? { id: changes.defaultPickupPointId, name: '' }
        : null
      : before.defaultPickupPoint;

  const after: PreferenceSnapshot = {
    defaultPickupPoint: afterPickup,
    preferredVehicleType:
      changes.preferredVehicleTypeId !== undefined
        ? changes.preferredVehicleTypeId
          ? { id: changes.preferredVehicleTypeId, name: '' }
          : null
        : before.preferredVehicleType,
    maxAcceptableFareShare:
      changes.maxAcceptableFareShare !== undefined
        ? changes.maxAcceptableFareShare
        : before.maxAcceptableFareShare,
    interestTags:
      changes.interestTags !== undefined
        ? changes.interestTags.map((t: { id: string; visible?: boolean }) => ({
            id: t.id,
            name: '',
            visible: t.visible ?? true,
          }))
        : before.interestTags,
  };

  return {
    id: row.id,
    userId: row.user_id,
    before,
    after,
    changes,
    status: currentStatus,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Confirms and executes an unexpired proposal (FR-RD-05.3, AI-RD-04).
 * If 10 minutes have elapsed, the proposal has lapsed and confirmation fails.
 */
export async function confirmPreferenceProposal(
  proposalId: string,
  userId: string,
  now: Date = new Date(),
): Promise<{ success: boolean; error?: string }> {
  if (!isUuid(proposalId) || !isUuid(userId)) {
    return { success: false, error: 'Invalid proposal or user ID.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{
      status: string;
      expires_at: Date;
      proposed_changes: ProposedPreferenceChanges;
    }>(
      `SELECT status, expires_at, proposed_changes
       FROM chatbot_preference_proposals
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [proposalId, userId],
    );

    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Proposal not found.' };
    }

    if (row.status !== 'pending') {
      await client.query('ROLLBACK');
      return { success: false, error: `Proposal is already ${row.status}.` };
    }

    if (row.expires_at <= now) {
      await client.query(
        `UPDATE chatbot_preference_proposals SET status = 'expired' WHERE id = $1`,
        [proposalId],
      );
      await client.query('COMMIT');
      return {
        success: false,
        error: 'This proposal has expired (unconfirmed proposals lapse after 10 minutes).',
      };
    }

    const changes =
      typeof row.proposed_changes === 'string'
        ? JSON.parse(row.proposed_changes)
        : row.proposed_changes;

    // Apply updates to user_profiles
    const updates: string[] = ['updated_at = now()'];
    const params: unknown[] = [userId];

    if (changes.defaultPickupPointId !== undefined) {
      params.push(changes.defaultPickupPointId);
      updates.push(`default_pickup_point_id = $${params.length}`);
    }

    if (changes.preferredVehicleTypeId !== undefined) {
      params.push(changes.preferredVehicleTypeId);
      updates.push(`preferred_vehicle_type_id = $${params.length}`);
    }

    if (changes.maxAcceptableFareShare !== undefined) {
      params.push(changes.maxAcceptableFareShare);
      updates.push(`max_acceptable_fare_share = $${params.length}`);
    }

    if (updates.length > 1) {
      await client.query(
        `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = $1`,
        params,
      );
    }

    // Apply interest tag changes if present
    if (changes.interestTags !== undefined) {
      await client.query('DELETE FROM user_profile_tags WHERE user_id = $1', [userId]);
      for (const tag of changes.interestTags) {
        await client.query(
          `INSERT INTO user_profile_tags (user_id, tag_id, is_visible) VALUES ($1, $2, $3)`,
          [userId, tag.id, tag.visible],
        );
      }
    }

    await client.query(
      `UPDATE chatbot_preference_proposals
       SET status = 'confirmed', applied_at = $2
       WHERE id = $1`,
      [proposalId, now],
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
