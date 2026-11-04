import { Pool } from 'pg';
import { testDatabaseUrl, databaseName } from '../../test/integration/test-database';

export interface E2ETestDatabase {
  pool: Pool | null;
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  cleanTransactionalData: () => Promise<void>;
  createRideRow: (ownerId: string, options?: Partial<TestRideOptions>) => Promise<string>;
  moveDeparture: (rideId: string, minutes: number) => Promise<void>;
  isAvailable: () => Promise<boolean>;
  close: () => Promise<void>;
}

export interface TestRideOptions {
  direction: 'to_hub' | 'from_hub';
  hubId: string;
  campusLocationId: string;
  departureStart: Date;
  departureEnd: Date;
  vehicleTypeId: string;
  capacity: number;
  expectedTotalFare: number;
  state: 'scheduled' | 'pickup_in_progress' | 'in_transit' | 'completed' | 'cancelled';
  lockedAt?: Date | null;
}

const DEFAULT_TEST_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://crp:pass@127.0.0.1:5433/crp_test';
const DEFAULT_ALLOW_RESET = process.env.ALLOW_TEST_DATABASE_RESET || databaseName(DEFAULT_TEST_URL);

let sharedPool: Pool | null = null;

export function getTestPool(): Pool | null {
  try {
    const verifiedUrl = testDatabaseUrl(DEFAULT_TEST_URL, DEFAULT_ALLOW_RESET);
    if (!sharedPool) {
      sharedPool = new Pool({
        connectionString: verifiedUrl,
        max: 5,
        connectionTimeoutMillis: 3_000,
      });
    }
    return sharedPool;
  } catch {
    // If not configured with a valid _test database or missing opt-in, fail safe
    return null;
  }
}

export async function closeTestPool(): Promise<void> {
  if (sharedPool) {
    const poolToClose = sharedPool;
    sharedPool = null;
    await poolToClose.end();
  }
}

export async function createTestDatabaseFixture(
  injectedPool?: Pool | null,
): Promise<E2ETestDatabase> {
  const pool = injectedPool !== undefined ? injectedPool : getTestPool();

  const isAvailable = async () => {
    if (!pool) return false;
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  };

  const query = async (text: string, values?: unknown[]) => {
    if (!pool) {
      throw new Error(
        'PostgreSQL test database is not available. Please verify TEST_DATABASE_URL.',
      );
    }
    const res = await pool.query(text, values);
    return { rows: res.rows };
  };

  const cleanTransactionalData = async () => {
    if (!pool) return;
    // Truncate only transactional tables, preserving reference tables (locations, vehicle_types, interest_tags, external_fare_ranges)
    await pool.query(`
      TRUNCATE TABLE
        sos_incidents,
        chatbot_audits,
        chatbot_preference_proposals,
        ride_final_shares,
        ride_recommendation_audits,
        ride_recommendation_feedback,
        ride_recommendation_reports,
        ride_recommendation_rate_events,
        ai_enforcement_decisions,
        complaint_ai_analyses,
        rider_suspensions,
        rider_warnings,
        complaint_chat_messages,
        complaints,
        admin_audit_log,
        ride_ratings,
        notifications,
        ride_chat_complaints,
        ride_chat_message_limits,
        ride_chat_messages,
        ride_chats,
        ride_join_request_events,
        ride_join_request_keys,
        alone,
        ride_join_requests,
        riders,
        rides,
        user_profile_tags,
        user_profiles,
        rate_limits,
        auth_tokens,
        sessions,
        users
      CASCADE;
    `);
  };

  const createRideRow = async (
    ownerId: string,
    options: Partial<TestRideOptions> = {},
  ): Promise<string> => {
    const direction = options.direction || 'to_hub';
    const hubId = options.hubId || 'kanpur-central';
    const campusLocationId = options.campusLocationId || 'hall-1';
    const vehicleTypeId = options.vehicleTypeId || 'car';
    const capacitySnapshot = options.capacity || 4;
    const now = new Date();
    const departureStart = options.departureStart || new Date(now.getTime() + 3 * 3600 * 1000);
    const departureEnd = options.departureEnd || new Date(departureStart.getTime() + 3600 * 1000);
    const expectedTotalFare = options.expectedTotalFare || 600;
    const state = options.state || 'scheduled';
    const lockedAt = options.lockedAt !== undefined ? options.lockedAt : null;

    let pickupStartedAt: Date | null = null;
    let tripStartedAt: Date | null = null;
    let completedAt: Date | null = null;
    let cancelledAt: Date | null = null;

    if (state === 'pickup_in_progress') {
      pickupStartedAt = new Date(now.getTime() - 20 * 60 * 1000);
    } else if (state === 'in_transit') {
      pickupStartedAt = new Date(now.getTime() - 40 * 60 * 1000);
      tripStartedAt = new Date(now.getTime() - 10 * 60 * 1000);
    } else if (state === 'completed') {
      pickupStartedAt = new Date(now.getTime() - 60 * 60 * 1000);
      tripStartedAt = new Date(now.getTime() - 30 * 60 * 1000);
      completedAt = now;
    } else if (state === 'cancelled') {
      cancelledAt = now;
    }

    const { rows } = await query(
      `INSERT INTO rides (
         owner_id, direction, hub_id, vehicle_type_id,
         capacity_snapshot, departure_start, departure_end,
         expected_total_fare, state, locked_at,
         pickup_started_at, trip_started_at, completed_at, cancelled_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        ownerId,
        direction,
        hubId,
        vehicleTypeId,
        capacitySnapshot,
        departureStart,
        departureEnd,
        expectedTotalFare,
        state,
        lockedAt,
        pickupStartedAt,
        tripStartedAt,
        completedAt,
        cancelledAt,
      ],
    );
    const rideId = rows[0].id as string;
    await query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id)
       VALUES ($1, $2, $3)`,
      [rideId, ownerId, campusLocationId],
    );
    return rideId;
  };

  const moveDeparture = async (rideId: string, minutes: number) => {
    if (!pool) return;
    await pool.query(
      `UPDATE rides
       SET departure_start = departure_start + make_interval(mins => $1),
           departure_end = departure_end + make_interval(mins => $1)
       WHERE id = $2`,
      [minutes, rideId],
    );
  };

  const close = async () => {
    await closeTestPool();
  };

  return {
    pool,
    query,
    cleanTransactionalData,
    createRideRow,
    moveDeparture,
    isAvailable,
    close,
  };
}
