// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  readJson: vi.fn(),
  withAdminAction: vi.fn(),
  changeComplaintStatus: vi.fn(),
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
vi.mock('@/lib/complaints', () => ({ changeComplaintStatus: h.changeComplaintStatus }));

import { PATCH } from './route';

const ID = 'c0c0c0c0-1111-4000-8000-000000000001';
const admin = { userId: '6f1c2a5e-0000-4000-8000-0000000000aa', role: 'admin' };
const CLIENT = { query: vi.fn() };
const state = (change: Record<string, unknown> = {}) => ({
  id: ID,
  reference: 'CMP-1A2B3C4D',
  status: 'under_review',
  actionTaken: null,
  note: null,
  version: 2,
  ...change,
});

const call = (id = ID) =>
  PATCH(new Request('http://localhost/api/admin/complaints/x', { method: 'PATCH' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/admin/complaints/[id]'>);

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminApi.mockResolvedValue({ admin });
  h.withAdminAction.mockImplementation(async (_admin, _meta, run) => run(CLIENT));
  h.readJson.mockResolvedValue({ status: 'under_review', version: 1 });
});

describe('PATCH /api/admin/complaints/[id] (OA-FR-18, CS455-52)', () => {
  it('moves a complaint on and answers with its new state, audited with before and after', async () => {
    h.changeComplaintStatus.mockResolvedValue({
      kind: 'changed',
      before: state({ status: 'submitted', version: 1 }),
      after: state(),
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ complaint: state() });
    expect(h.withAdminAction.mock.calls[0][1]).toEqual({
      action: 'complaint.status',
      entityType: 'complaint',
      entityId: ID,
      reason: undefined,
    });
    expect(h.changeComplaintStatus).toHaveBeenCalledWith(
      CLIENT,
      ID,
      { status: 'under_review', version: 1 },
      admin.userId,
      expect.any(Date),
    );
    const result = await h.withAdminAction.mock.results[0].value;
    expect(result).toMatchObject({
      before: { status: 'submitted' },
      after: { status: 'under_review' },
    });
  });

  it('needs whether action was taken to resolve', async () => {
    h.readJson.mockResolvedValue({ status: 'resolved', version: 2 });
    const res = await call();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      fields: { actionTaken: 'Say whether any action was taken.' },
    });
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('answers 409 with the current state on a stale change, or on a resolved complaint', async () => {
    h.changeComplaintStatus.mockResolvedValue({
      kind: 'version_conflict',
      current: state({ version: 3 }),
    });
    expect(await (await call()).json()).toMatchObject({
      code: 'version_conflict',
      current: { version: 3 },
    });

    h.changeComplaintStatus.mockResolvedValue({
      kind: 'not_allowed',
      current: state({ status: 'resolved' }),
    });
    const resolved = await call();
    expect(resolved.status).toBe(409);
    expect(await resolved.json()).toMatchObject({
      code: 'not_allowed',
      error: 'This complaint is already resolved, so its status cannot change.',
      current: { status: 'resolved' },
    });

    h.changeComplaintStatus.mockResolvedValue({ kind: 'not_allowed', current: state() });
    expect(await (await call()).json()).toMatchObject({
      error: 'This complaint is already under review.',
    });
  });

  it('answers 404 for an unknown complaint or an ID that is not a UUID', async () => {
    h.changeComplaintStatus.mockResolvedValue({ kind: 'not_found' });
    expect((await call()).status).toBe(404);
    expect((await call('abc')).status).toBe(404);
  });

  it('passes on the refusal for anyone but an admin', async () => {
    h.requireAdminApi.mockResolvedValue({ response: Response.json({}, { status: 401 }) });
    expect((await call()).status).toBe(401);
  });
});
