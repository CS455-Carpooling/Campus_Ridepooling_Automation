// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  getCurrentUser: vi.fn(),
  guard: vi.fn(),
  getProfileData: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: m.poolQuery, connect: m.connect } }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: m.getCurrentUser,
  guard: m.guard,
  json: (body: object, status = 200) => Response.json(body, { status }),
  readJson: async (req: Request) => req.json(),
}));
vi.mock('@/lib/profile-data', () => ({ getProfileData: m.getProfileData }));

import { GET, PUT } from './route';

const profile = {
  email: 'rider@iitk.ac.in',
  fullName: 'Rider Name',
  rollNumber: '220123',
  displayName: 'Rider',
  defaultPickupPointId: 'hall-3',
  preferredVehicleTypeId: null,
  maxAcceptableFareShare: null,
  aiTagConsent: false,
  mobileNumber: null,
  locations: [{ id: 'hall-3', name: 'Hall 3' }],
  vehicles: [{ id: 'car', name: 'Car' }],
  tags: [{ id: 'quiet-ride', name: 'Quiet ride', selected: false, visible: true }],
  completedTrips: 0,
  rating: { count: 0, average: null, comments: [] },
};

const validUpdate = {
  displayName: 'Rider One',
  defaultPickupPointId: 'hall-3',
  interestTags: [{ id: 'quiet-ride', visible: true }],
  preferredVehicleTypeId: 'car',
  maxAcceptableFareShare: 500,
  aiTagConsent: false,
  mobileNumber: null,
};

const post = (body: Record<string, unknown>) =>
  PUT(
    new Request('http://localhost/api/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getCurrentUser.mockResolvedValue({ id: 'u1' });
  m.guard.mockResolvedValue(null);
  m.getProfileData.mockResolvedValue(profile);
  m.clientQuery.mockImplementation((sql: string) => {
    if (sql === "SELECT id FROM locations WHERE id = $1 AND type = 'campus' AND is_active = true") {
      return Promise.resolve({ rows: [{ id: 'hall-3' }] });
    }
    if (sql === 'SELECT id FROM vehicle_types WHERE id = $1 AND is_active = true') {
      return Promise.resolve({ rows: [{ id: 'car' }] });
    }
    if (sql === 'SELECT id FROM interest_tags WHERE id = ANY($1::text[]) AND is_active = true') {
      return Promise.resolve({ rows: [{ id: 'quiet-ride' }] });
    }
    return Promise.resolve({ rows: [] });
  });
  m.connect.mockResolvedValue({ query: m.clientQuery, release: m.release });
});

describe('/api/profile', () => {
  it('requires authentication for GET', async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('returns only the signed-in user profile', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ profile });
    expect(m.getProfileData).toHaveBeenCalledWith('u1');
  });

  it('checks same-origin and rate guard before profile updates', async () => {
    m.guard.mockResolvedValue(new Response('blocked', { status: 403 }));
    expect((await post(validUpdate)).status).toBe(403);
    expect(m.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['too-short display name', { ...validUpdate, displayName: 'A' }],
    ['too-long display name', { ...validUpdate, displayName: 'x'.repeat(41) }],
    [
      'more than ten tags',
      {
        ...validUpdate,
        interestTags: Array.from({ length: 11 }, (_, i) => ({ id: `${i}`, visible: true })),
      },
    ],
    ['invalid phone number', { ...validUpdate, mobileNumber: '12345' }],
    ['invalid fare amount', { ...validUpdate, maxAcceptableFareShare: 0 }],
    ['missing consent value', { ...validUpdate, aiTagConsent: undefined }],
  ])('rejects %s without opening a transaction', async (_, body) => {
    expect((await post(body)).status).toBe(400);
    expect(m.connect).not.toHaveBeenCalled();
  });

  it('saves profile fields and tag visibility atomically', async () => {
    const response = await post(validUpdate);
    expect(await response.json()).toEqual({ ok: true });
    expect(m.connect).toHaveBeenCalledOnce();
    expect(m.clientQuery.mock.calls[0][0]).toBe('BEGIN');
    expect(m.clientQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE user_profiles'), [
      'u1',
      'Rider One',
      'hall-3',
      'car',
      500,
      false,
      null,
    ]);
    expect(m.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_profile_tags'),
      ['u1', 'quiet-ride', true],
    );
    expect(m.clientQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(m.release).toHaveBeenCalledOnce();
  });

  it('rejects inactive configured values and rolls back', async () => {
    m.clientQuery.mockImplementation((sql: string) => {
      if (
        sql === "SELECT id FROM locations WHERE id = $1 AND type = 'campus' AND is_active = true"
      ) {
        return Promise.resolve({ rows: [] });
      }
      if (sql === 'SELECT id FROM vehicle_types WHERE id = $1 AND is_active = true') {
        return Promise.resolve({ rows: [{ id: 'car' }] });
      }
      if (sql === 'SELECT id FROM interest_tags WHERE id = ANY($1::text[]) AND is_active = true') {
        return Promise.resolve({ rows: [{ id: 'quiet-ride' }] });
      }
      return Promise.resolve({ rows: [] });
    });
    expect((await post(validUpdate)).status).toBe(400);
    expect(m.clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(m.release).toHaveBeenCalledOnce();
  });
});
