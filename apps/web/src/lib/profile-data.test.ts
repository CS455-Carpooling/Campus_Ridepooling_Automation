// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ query: vi.fn(), getOwnRating: vi.fn() }));
vi.mock('./db', () => ({ pool: { query: h.query } }));
vi.mock('./rating-summary', () => ({ getOwnRating: h.getOwnRating }));

import { getProfileData, hasCompletedProfileSetup } from './profile-data';

const USER = '6f1c2a5e-2222-4000-8000-000000000001';
const rating = { count: 0, average: null, comments: [] };

beforeEach(() => {
  vi.clearAllMocks();
  h.getOwnRating.mockResolvedValue(rating);
  h.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM users u JOIN user_profiles p')) {
      return {
        rows: [
          {
            email: 'student@iitk.ac.in',
            full_name: 'A Student',
            roll_number: '230001',
            display_name: 'Student',
            default_pickup_point_id: 'hall-1',
            preferred_vehicle_type_id: null,
            max_acceptable_fare_share: null,
            ai_tag_consent: false,
            mobile_number: null,
          },
        ],
      };
    }
    if (sql.includes('count(DISTINCT r.id)')) return { rows: [{ count: '2' }] };
    return { rows: [] };
  });
});

describe('getProfileData', () => {
  it('counts only the trips the person completed: not ones they left or missed (FR-RD-02.4)', async () => {
    await expect(getProfileData(USER)).resolves.toMatchObject({
      displayName: 'Student',
      completedTrips: 2,
      rating,
    });

    const count = h.query.mock.calls.find(([sql]) => String(sql).includes('count(DISTINCT r.id)'));
    expect(count?.[0]).toContain("r.state = 'completed'");
    expect(count?.[0]).toContain('m.left_at IS NULL AND m.no_show_at IS NULL');
    expect(count?.[1]).toEqual([USER]);
  });

  it('is null when the account has no profile row', async () => {
    h.query.mockResolvedValue({ rows: [] });
    await expect(getProfileData(USER)).resolves.toBeNull();
  });
});

describe('hasCompletedProfileSetup', () => {
  it('requires an active campus pickup point', async () => {
    h.query.mockResolvedValueOnce({ rows: [{ ready: true }] });
    await expect(hasCompletedProfileSetup(USER)).resolves.toBe(true);
    const [sql, params] = h.query.mock.calls[0];
    expect(sql).toContain("l.type = 'campus' AND l.is_active = TRUE");
    expect(params).toEqual([USER]);
  });

  it('returns false until an active campus pickup point is saved', async () => {
    h.query.mockResolvedValueOnce({ rows: [{ ready: false }] });
    await expect(hasCompletedProfileSetup(USER)).resolves.toBe(false);
  });
});
