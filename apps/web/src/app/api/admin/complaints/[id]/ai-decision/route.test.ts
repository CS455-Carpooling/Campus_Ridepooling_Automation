// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  readJson: vi.fn(),
  withAdminAction: vi.fn(),
  decideComplaintAi: vi.fn(),
}));
vi.mock('@/lib/admin-auth', () => ({ requireAdminApi: h.requireAdminApi }));
vi.mock('@/lib/auth', () => ({
  readJson: h.readJson,
  json: (body: object, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/admin-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin-actions')>()),
  withAdminAction: h.withAdminAction,
}));
vi.mock('@/lib/ai-enforcement', () => ({ decideComplaintAi: h.decideComplaintAi }));

import { POST } from './route';

const ID = 'c0c0c0c0-1111-4000-8000-000000000001';
const ANALYSIS = 'd0d0d0d0-1111-4000-8000-000000000001';
const admin = { userId: '6f1c2a5e-0000-4000-8000-0000000000aa', role: 'admin' };
const CLIENT = { query: vi.fn() };
const call = (id = ID) =>
  POST(new Request('http://localhost/api/admin/complaints/x/ai-decision', { method: 'POST' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/admin/complaints/[id]/ai-decision'>);

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminApi.mockResolvedValue({ admin });
  h.readJson.mockResolvedValue({
    analysisId: ANALYSIS,
    decision: 'rejected',
    finalAction: 'none',
    reason: 'Not supported.',
  });
  h.withAdminAction.mockImplementation(async (_admin, _meta, run) => run(CLIENT));
  h.decideComplaintAi.mockResolvedValue({
    kind: 'done',
    record: { id: 'e1', decision: 'rejected', finalAction: 'none' },
    before: { recommendedAction: 'warning' },
  });
});

describe('POST /api/admin/complaints/[id]/ai-decision', () => {
  it('records an authorized, audited decision', async () => {
    const response = await call();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      decision: { id: 'e1', decision: 'rejected', finalAction: 'none' },
    });
    expect(h.withAdminAction.mock.calls[0][1]).toMatchObject({
      action: 'ai.decide',
      entityType: 'complaint',
      entityId: ID,
      reason: 'Not supported.',
    });
    expect(h.decideComplaintAi).toHaveBeenCalledWith(
      CLIENT,
      ID,
      ANALYSIS,
      expect.objectContaining({ decision: 'rejected', finalAction: 'none' }),
      admin.userId,
      expect.any(Date),
    );
  });

  it('requires a rejection reason and a valid analysis ID', async () => {
    h.readJson.mockResolvedValue({
      analysisId: ANALYSIS,
      decision: 'rejected',
      finalAction: 'none',
    });
    expect((await call()).status).toBe(400);
    h.readJson.mockResolvedValue({ decision: 'rejected', finalAction: 'none', reason: 'No.' });
    expect((await call()).status).toBe(400);
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('passes through authorization refusals', async () => {
    h.requireAdminApi.mockResolvedValue({ response: Response.json({}, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('returns a conflict when enforcement is refused because the complaint is resolved', async () => {
    h.decideComplaintAi.mockResolvedValue({ kind: 'complaint_resolved' });
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'complaint_resolved',
      error: expect.stringContaining('resolved'),
    });
  });
});
