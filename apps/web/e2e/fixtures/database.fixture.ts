import { Pool } from 'pg';
import { testDatabaseUrl, databaseName } from '../../test/integration/test-database';
import type { Queryable } from '../../test/seed/accounts';

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
  originId: string;
  destinationId: string;
  departureTime: Date;
  vehicleType: string;
  capacity: number;
  totalFare: number;
  state: 'scheduled' | 'pickup_in_progress' | 'in_transit' | 'completed' | 'cancelled';
  lockedAt?: Date | null;
}

const DEFAULT_TEST_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://crp:pass@127.0.0.1:5433/crp_test';
const DEFAULT_ALLOW_RESET =
  process.env.ALLOW_TEST_DATABASE_RESET || databaseName(DEFAULT_TEST_URL);

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
  } catch (error) {
    // If not configured with a valid _test database or missing opt-in, fail safe
    return null;
  }
}

export async function createTestDatabaseFixture(): Promise<E2ETestDatabase> {
  const pool = getTestPool();

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
    // Truncate only transactional tables, preserving configuration and locations
    await pool.query(`
      TRUNCATE TABLE
        incidents,
        complaints,
        ride_chat_reports,
        ride_chats,
        fare_settlements,
        ride_ratings,
        ride_requests,
        rides,
        user_warnings,
        user_suspensions,
        sessions,
        user_profiles,
        users
      CASCADE;
    `);
  };

  const createRideRow = async (
    ownerId: string,
    options: Partial<TestRideOptions> = {},
  ): Promise<string> => {
    const originId = options.originId || 'hall-1';
    const destinationId = options.destinationId || 'kanpur-central';
    const departureTime = options.departureTime || new Date(Date.now() + 4 * 3600 * 1000);
    const vehicleType = options.vehicleType || 'cab';
    const capacity = options.capacity || 4;
    const totalFare = options.totalFare || 350;
    const state = options.state || 'scheduled';
    const lockedAt = options.lockedAt !== undefined ? options.lockedAt : null;

    const { rows } = await query(
      `INSERT INTO rides (
         owner_id, origin_id, destination_id, departure_time, vehicle_type,
         capacity, total_fare, state, locked_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        ownerId,
        originId,
        destinationId,
        departureTime,
        vehicleType,
        capacity,
        totalFare,
        state,
        lockedAt,
      ],
    );
    return rows[0].id as string;
  };

  const moveDeparture = async (rideId: string, minutes: number) => {
    if (!pool) return;
    await pool.query(
      `UPDATE rides
       SET departure_time = departure_time + make_interval(mins => $1)
       WHERE id = $2`,
      [minutes, rideId],
    );
  };

  const close = async () => {
    // Keep connection alive across tests, closed on process exit
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
