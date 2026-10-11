// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  readJson: vi.fn(),
  withAdminAction: vi.fn(),
  warnRider: vi.fn(),
  suspendRider: vi.fn(),
  reactivateRider: vi.fn(),
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
vi.mock('@/lib/enforcement', () => ({
  warnRider: h.warnRider,
  suspendRider: h.suspendRider,
  reactivateRider: h.reactivateRider,
}));

import { POST as reactivate } from './reactivation/route';
import { POST as suspend } from './suspensions/route';
import { POST as warn } from './warnings/route';

const RIDER = '6f1c2a5e-2222-4000-8000-000000000001';
const admin = { userId: '6f1c2a5e-0000-4000-8000-0000000000aa', role: 'admin' };
const CLIENT = { query: vi.fn() };
const request = () => new Request('http://localhost/api/admin/riders/x', { method: 'POST' });
const ctx = (id = RIDER) => ({ params: Promise.resolve({ id }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminApi.mockResolvedValue({ admin });
  h.withAdminAction.mockImplementation(async (_admin, _meta, run) => run(CLIENT));
});

describe('rider enforcement routes (OA-FR-21 to 28, CS455-52)', () => {
  it('warn: 201, with the reason in the audit record', async () => {
    h.readJson.mockResolvedValue({ reason: 'Late twice' });
    h.warnRider.mockResolvedValue({
      kind: 'done',
      record: { id: 'w-1', userId: RIDER, issuedAt: 'now' },
    });
    const res = await warn(request(), ctx());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ warning: { id: 'w-1', userId: RIDER, issuedAt: 'now' } });
    expect(h.withAdminAction.mock.calls[0][1]).toEqual({
      action: 'rider.warn',
      entityType: 'user',
      entityId: RIDER,
      reason: 'Late twice',
    });
    expect(h.warnRider).toHaveBeenCalledWith(
      CLIENT,
      RIDER,
      { reason: 'Late twice', complaintId: null },
      admin.userId,
    );
  });

  it('warn: needs a reason', async () => {
    h.readJson.mockResolvedValue({});
    const res = await warn(request(), ctx());
    expect(res.status).toBe(400);
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('suspend: needs a length or indefinite, and refuses a second suspension', async () => {
    h.readJson.mockResolvedValue({ reasonCategory: 'safety', reason: 'Unsafe driving' });
    expect((await suspend(request(), ctx())).status).toBe(400);

    h.readJson.mockResolvedValue({ reasonCategory: 'safety', reason: 'Unsafe driving', days: 3 });
    h.suspendRider.mockResolvedValue({ kind: 'already_suspended', endsAt: null });
    const twice = await suspend(request(), ctx());
    expect(twice.status).toBe(409);
    expect(await twice.json()).toMatchObject({ code: 'already_suspended' });

    h.suspendRider.mockResolvedValue({ kind: 'done', record: { id: 's-1' } });
    const res = await suspend(request(), ctx());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ suspension: { id: 's-1' } });
    expect(h.withAdminAction.mock.calls.at(-1)?.[1]).toMatchObject({ action: 'rider.suspend' });
  });

  it('reactivate: needs a reason, and refuses a rider who is not suspended', async () => {
    h.readJson.mockResolvedValue({ reason: '' });
    expect((await reactivate(request(), ctx())).status).toBe(400);

    h.readJson.mockResolvedValue({ reason: 'Appeal accepted' });
    h.reactivateRider.mockResolvedValue({ kind: 'not_suspended' });
    expect((await reactivate(request(), ctx())).status).toBe(409);

    h.reactivateRider.mockResolvedValue({ kind: 'done', record: { suspensionId: 's-1' } });
    const res = await reactivate(request(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reactivation: { suspensionId: 's-1' } });
    expect(h.withAdminAction.mock.calls.at(-1)?.[1]).toMatchObject({
      action: 'rider.reactivate',
      reason: 'Appeal accepted',
    });
  });

  it('answer 404 for an ID that is not a UUID, and pass on refusals for non-admins', async () => {
    expect((await warn(request(), ctx('nobody'))).status).toBe(404);
    expect((await suspend(request(), ctx('nobody'))).status).toBe(404);
    expect((await reactivate(request(), ctx('nobody'))).status).toBe(404);
    h.requireAdminApi.mockResolvedValue({ response: Response.json({}, { status: 403 }) });
    expect((await warn(request(), ctx())).status).toBe(403);
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });
});
