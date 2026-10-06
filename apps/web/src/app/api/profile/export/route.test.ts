// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  query: vi.fn(),
  getCurrentUser: vi.fn(),
  getProfileData: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: m.query } }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: m.getCurrentUser,
  json: (body: object, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/profile-data', () => ({ getProfileData: m.getProfileData }));

import { GET } from './route';

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getCurrentUser.mockResolvedValue({ id: 'u1' });
  m.getProfileData.mockResolvedValue({
    email: 'rider@iitk.ac.in',
    fullName: 'Rider Name',
    rollNumber: '220123',
    mobileNumber: '9876543210',
    tags: [{ id: 'quiet-ride', selected: true, visible: false }],
  });
  m.query.mockResolvedValue({ rows: [{ id: 'ride1', direction: 'to_hub' }] });
});

describe('GET /api/profile/export', () => {
  it('requires authentication', async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('downloads only the signed-in user account, profile and trip data as JSON', async () => {
    const response = await GET();
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.headers.get('content-disposition')).toContain('campus-ride-pooling-data.json');
    const body = await response.json();
    expect(body.account).toEqual({
      email: 'rider@iitk.ac.in',
      fullName: 'Rider Name',
      rollNumber: '220123',
    });
    expect(body.profile.mobileNumber).toBe('9876543210');
    expect(body.rides).toEqual([{ id: 'ride1', direction: 'to_hub' }]);
    expect(m.query.mock.calls[0][1]).toEqual(['u1']);
  });
});
