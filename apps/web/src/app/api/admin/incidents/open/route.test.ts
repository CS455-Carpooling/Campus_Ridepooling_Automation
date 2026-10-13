// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ requireAdminApi: vi.fn(), openIncidentSummary: vi.fn() }));

vi.mock('@/lib/admin-auth', () => ({ requireAdminApi: h.requireAdminApi }));
vi.mock('@/lib/admin-incident-queries', () => ({ openIncidentSummary: h.openIncidentSummary }));
vi.mock('@/lib/auth', () => ({
  json: (body: object, status = 200) => Response.json(body, { status }),
}));

import { GET } from './route';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/incidents/open (CS455-65, P-22)', () => {
  it('gives an admin the unacknowledged alerts', async () => {
    h.requireAdminApi.mockResolvedValue({ admin: { userId: 'a1', role: 'admin' } });
    h.openIncidentSummary.mockResolvedValue({ unacknowledged: 0, newest: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unacknowledged: 0, newest: null });
    expect(h.requireAdminApi).toHaveBeenCalledWith();
  });

  it('refuses anyone else', async () => {
    h.requireAdminApi.mockResolvedValue({ response: Response.json({}, { status: 403 }) });
    expect((await GET()).status).toBe(403);
    expect(h.openIncidentSummary).not.toHaveBeenCalled();
  });
});
