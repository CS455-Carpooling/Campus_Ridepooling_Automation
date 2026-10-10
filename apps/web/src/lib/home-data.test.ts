import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUpcomingRides = vi.hoisted(() => vi.fn());
const getHistoricalRides = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => vi.fn());
vi.mock('./ride-view', () => ({ getUpcomingRides, getHistoricalRides }));
vi.mock('./db', () => ({ pool: { query } }));

import { getAdminHome, getStudentHome } from './home-data';

beforeEach(() => {
  getUpcomingRides.mockReset();
  getHistoricalRides.mockReset();
  query.mockReset();
});

describe('home data', () => {
  it('loads upcoming and historical rides for the dashboard', async () => {
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
    const now = new Date('2026-10-05T12:00:00Z');
    await expect(getStudentHome('u1', now)).resolves.toEqual({
      upcoming: [ride],
      history: [pastRide],
      waiting: [],
    });
    expect(getUpcomingRides).toHaveBeenCalledWith('u1', now);
    expect(getHistoricalRides).toHaveBeenCalledWith('u1', now);
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
        : { rows: [{ complaints: 4, safety: 1, recommendations: 2, suspended: 3 }] },
    );
    await expect(getAdminHome()).resolves.toEqual({
      openIncidents: null,
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
