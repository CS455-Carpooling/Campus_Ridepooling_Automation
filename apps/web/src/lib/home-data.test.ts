import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUpcomingRides = vi.hoisted(() => vi.fn());
const getHistoricalRides = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => vi.fn());

vi.mock('./ride-view', () => ({
  getUpcomingRides,
  getHistoricalRides,
}));

vi.mock('./db', () => ({
  pool: { query },
}));

import { getAdminHome, getStudentHome } from './home-data';

beforeEach(() => {
  getUpcomingRides.mockReset();
  getHistoricalRides.mockReset();
  query.mockReset();
});

describe('home data', () => {
  it('loads rides and join-request history for the student dashboard', async () => {
    const userId = '12345678-1234-4123-8123-123456789abc';
    const ride = {
      rideId: 'r1',
      title: 'To Kanpur Central',
      departure: '2026-10-10T01:00:00.000Z',
      part: 'owner',
      seatsLeft: 3,
      state: 'scheduled',
    };

    const pastRide = { rideId: 'r2', state: 'completed' };

    getUpcomingRides.mockResolvedValue([ride]);
    getHistoricalRides.mockResolvedValue([pastRide]);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('UNION ALL')) {
        return {
          rows: [
            {
              kind: 'sent',
              request_id: 'q1',
              ride_id: 'r3',
              destination: 'Kanpur Central',
              departure: new Date('2026-10-10T01:00:00Z'),
              rider_name: null,
              status: 'pending',
            },
          ],
        };
      }

      if (sql.includes('ride_join_request_events')) {
        return {
          rows: [
            {
              id: 'h1',
              request_id: 'q1',
              previous_status: null,
              new_status: 'pending',
              reason_code: null,
              changed_at: new Date('2026-10-05T12:00:00Z'),
            },
          ],
        };
      }

      if (sql.includes('ride_join_requests')) {
        return {
          rows: [
            {
              request_id: 'q1',
              ride_id: 'r3',
              destination: 'Hall 5 → Kanpur Central',
              departure: new Date('2026-10-10T01:00:00Z'),
              pickup_point: 'Hall 5',
              status: 'pending',
              estimated_share: '120',
              reason_code: null,
              submitted_at: new Date('2026-10-05T12:00:00Z'),
              updated_at: new Date('2026-10-05T12:00:00Z'),
            },
          ],
        };
      }

      return { rows: [] };
    });
    const now = new Date('2026-10-05T12:00:00Z');

    await expect(getStudentHome(userId, now)).resolves.toEqual({
      upcoming: [ride],
      history: [pastRide],
      waiting: [
        {
          kind: 'sent',
          requestId: 'q1',
          rideId: 'r3',
          destination: 'Kanpur Central',
          departure: '2026-10-10T01:00:00.000Z',
          state: 'pending',
        },
      ],
      joinRequests: [
        {
          requestId: 'q1',
          rideId: 'r3',
          destination: 'Hall 5 → Kanpur Central',
          departure: '2026-10-10T01:00:00.000Z',
          pickupPoint: 'Hall 5',
          status: 'pending',
          estimatedShare: 120,
          reasonCode: null,
          submittedAt: '2026-10-05T12:00:00.000Z',
          updatedAt: '2026-10-05T12:00:00.000Z',
          history: [
            {
              id: 'h1',
              previousStatus: null,
              newStatus: 'pending',
              reasonCode: null,
              changedAt: '2026-10-05T12:00:00.000Z',
            },
          ],
        },
      ],
    });

    expect(getUpcomingRides).toHaveBeenCalledWith(userId, now);
    expect(getHistoricalRides).toHaveBeenCalledWith(userId, now);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('counts open complaints, AI items, suspensions, and lists the last admin actions', async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes('FROM admin_audit_log')
        ? {
            rows: [
              {
                id: 'e1',
                action: 'rider.warn',
                actor_type: 'admin',
                admin_name: 'Ops Admin',
                outcome: 'succeeded',
                created_at: new Date('2026-10-10T22:51:00Z'),
                subject: 'Aditi Rao',
              },
            ],
          }
        : {
            rows: [
              {
                complaints: 4,
                safety: 1,
                recommendations: 2,
                suspended: 3,
                incidents: 2,
                unacknowledged: 1,
              },
            ],
          },
    );

    await expect(getAdminHome()).resolves.toEqual({
      openIncidents: 2,
      unacknowledgedIncidents: 1,
      complaintsToReview: 4,
      safetyComplaintsToReview: 1,
      recommendationsToDecide: 2,
      ridersSuspended: 3,
      recentActions: [
        {
          id: 'e1',
          action: 'rider.warn',
          actor: 'admin',
          adminName: 'Ops Admin',
          subject: 'Aditi Rao',
          outcome: 'succeeded',
          at: '2026-10-10T22:51:00.000Z',
        },
      ],
    });
  });

  it('reads complaints, chat reports included, not the old chat report table (CS455-49)', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(getAdminHome()).resolves.toMatchObject({
      complaintsToReview: 0,
      recommendationsToDecide: 0,
      ridersSuspended: 0,
      recentActions: [],
    });

    const sql = query.mock.calls.map(([text]) => String(text)).join(' ');

    expect(sql).toContain('FROM complaints');
    expect(sql).toContain('active_rider_suspensions');
    expect(sql).toContain('LIMIT 10');
    expect(sql).not.toContain('ride_chat_complaints');
  });
});
