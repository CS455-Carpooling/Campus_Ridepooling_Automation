// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  readJson: vi.fn(),
  withAdminAction: vi.fn(),
  changeIncident: vi.fn(),
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
vi.mock('@/lib/incidents', () => ({ changeIncident: h.changeIncident }));

import { PATCH } from './route';

const ID = 'a5a5a5a5-5555-4000-8000-000000000001';
const admin = { userId: '6f1c2a5e-0000-4000-8000-0000000000aa', role: 'admin' };
const CLIENT = { query: vi.fn() };
const state = (status: string) => ({
  id: ID,
  reference: 'SOS-1A2B3C4D',
  status,
  acknowledgedAt: null,
  closedAt: null,
});

const call = (id = ID) =>
  PATCH(new Request('http://localhost/api/admin/incidents/x', { method: 'PATCH' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/admin/incidents/[id]'>);

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminApi.mockResolvedValue({ admin });
  h.withAdminAction.mockImplementation(async (_admin, _meta, run) => run(CLIENT));
  h.readJson.mockResolvedValue({ action: 'acknowledge' });
});

describe('PATCH /api/admin/incidents/[id] (CS455-65)', () => {
  it('acknowledges an alert, audited with before and after', async () => {
    h.changeIncident.mockResolvedValue({
      kind: 'changed',
      before: state('open'),
      after: state('acknowledged'),
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ incident: state('acknowledged') });
    expect(h.requireAdminApi).toHaveBeenCalledWith({ write: true });
    expect(h.withAdminAction.mock.calls[0][1]).toEqual({
      action: 'incident.acknowledge',
      entityType: 'sos_incident',
      entityId: ID,
      reason: null,
    });
    expect(h.changeIncident).toHaveBeenCalledWith(
      CLIENT,
      ID,
      { action: 'acknowledge' },
      admin.userId,
      expect.any(Date),
    );
  });

  it('closes with the note as the audited reason', async () => {
    h.readJson.mockResolvedValue({ action: 'close', note: 'Called the rider.' });
    h.changeIncident.mockResolvedValue({
      kind: 'changed',
      before: state('acknowledged'),
      after: state('closed'),
    });
    expect((await call()).status).toBe(200);
    expect(h.withAdminAction.mock.calls[0][1]).toMatchObject({
      action: 'incident.close',
      reason: 'Called the rider.',
    });
  });

  it('refuses a close without a note with 400, and an unknown ID with 404', async () => {
    h.readJson.mockResolvedValue({ action: 'close' });
    const invalid = await call();
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ fields: { note: expect.any(String) } });
    expect((await call('nope')).status).toBe(404);
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('answers 404 and 409 with the incident as it is now', async () => {
    h.changeIncident.mockResolvedValueOnce({ kind: 'not_found' });
    expect((await call()).status).toBe(404);
    h.changeIncident.mockResolvedValueOnce({
      kind: 'refused',
      code: 'closed',
      current: state('closed'),
    });
    const closed = await call();
    expect(closed.status).toBe(409);
    expect(await closed.json()).toEqual({
      error: 'This incident is already closed.',
      code: 'closed',
      current: state('closed'),
    });
    h.changeIncident.mockResolvedValueOnce({
      kind: 'refused',
      code: 'already_acknowledged',
      current: state('acknowledged'),
    });
    expect(await (await call()).json()).toMatchObject({
      error: 'This incident is already acknowledged.',
    });
  });

  it('passes on the refusal for students and signed-out users', async () => {
    h.requireAdminApi.mockResolvedValue({ response: Response.json({}, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(h.readJson).not.toHaveBeenCalled();
  });
});
