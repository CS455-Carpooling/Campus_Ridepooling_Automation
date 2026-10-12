// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  fileComplaint: vi.fn(),
  analyzeComplaint: vi.fn(),
  after: vi.fn(),
  scheduled: [] as Array<() => unknown>,
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: (body: object, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/db', () => ({ pool: { connect: h.connect } }));
vi.mock('@/lib/complaints', () => ({ fileComplaint: h.fileComplaint }));
vi.mock('@/lib/complaint-ai', () => ({ analyzeComplaint: h.analyzeComplaint }));
vi.mock('next/server', () => ({ after: h.after }));

import { POST } from './route';

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const USER = '6f1c2a5e-2222-4000-8000-000000000001';
const SEAT = 'a1a1a1a1-3333-4000-8000-000000000002';
const body = {
  occupantId: SEAT,
  category: 'tardiness',
  description: 'Arrived 25 minutes late to the pickup.',
};

const call = (id = RIDE) =>
  POST(new Request('http://localhost/api/rides/x/complaints', { method: 'POST' }), {
    params: Promise.resolve({ id }),
  } as RouteContext<'/api/rides/[id]/complaints'>);

const sqlCalls = () => h.clientQuery.mock.calls.map(([sql]) => sql);

beforeEach(() => {
  vi.clearAllMocks();
  h.scheduled.length = 0;
  h.after.mockImplementation((callback: () => unknown) => {
    h.scheduled.push(callback);
  });
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER });
  h.readJson.mockResolvedValue({ ...body });
  h.connect.mockResolvedValue({ query: h.clientQuery, release: h.release });
  h.clientQuery.mockResolvedValue({ rows: [] });
  h.fileComplaint.mockResolvedValue({
    kind: 'filed',
    id: 'c0c0c0c0-1111-4000-8000-000000000001',
    reference: 'CMP-1A2B3C4D',
  });
});

describe('POST /api/rides/[id]/complaints (FR-RD-13.1 to 13.4, CS455-52)', () => {
  it('files the complaint in a transaction and answers only the reference (FR-RD-13.2)', async () => {
    const res = await call();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ reference: 'CMP-1A2B3C4D' });
    expect(sqlCalls()).toEqual(['BEGIN', 'COMMIT']);
    expect(h.fileComplaint).toHaveBeenCalledWith(
      expect.anything(),
      RIDE,
      USER,
      { ...body, messageId: null },
      expect.any(Date),
    );
    expect(h.release).toHaveBeenCalledOnce();
    expect(h.after).toHaveBeenCalledOnce();
    expect(h.analyzeComplaint).not.toHaveBeenCalled();
    await h.scheduled[0]();
    expect(h.analyzeComplaint).toHaveBeenCalledWith('c0c0c0c0-1111-4000-8000-000000000001');
  });

  it('passes on the origin check and rate limit, and needs sign-in', async () => {
    h.guard.mockResolvedValue(Response.json({}, { status: 429 }));
    expect((await call()).status).toBe(429);
    h.guard.mockResolvedValue(null);
    h.getCurrentUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('refuses a short description with its field message, before the database', async () => {
    h.readJson.mockResolvedValue({ ...body, description: 'Late.' });
    const res = await call();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'invalid',
      fields: { description: expect.any(String) },
    });
    expect(h.connect).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'not_found' }, 404, 'not_found'],
    [{ kind: 'not_on_ride' }, 400, 'not_on_ride'],
    [{ kind: 'self' }, 400, 'invalid'],
    [{ kind: 'message_not_found' }, 400, 'invalid'],
    [{ kind: 'window', window: 'closed' }, 409, 'window_closed'],
    [{ kind: 'window', window: 'not_completed' }, 409, 'window_closed'],
    [{ kind: 'window', window: 'cancelled' }, 409, 'window_closed'],
    [{ kind: 'already_filed', reference: 'CMP-OLD00001' }, 409, 'already_filed'],
    [{ kind: 'daily_limit' }, 429, 'daily_limit'],
  ])('rolls back and refuses %o', async (result, status, code) => {
    h.fileComplaint.mockResolvedValue(result);
    const res = await call();
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ code });
    expect(sqlCalls()).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('says which complaint was already filed', async () => {
    h.fileComplaint.mockResolvedValue({ kind: 'already_filed', reference: 'CMP-OLD00001' });
    expect(await (await call()).json()).toMatchObject({ reference: 'CMP-OLD00001' });
  });

  it('answers 404 for a ride ID that is not a UUID, without a query', async () => {
    expect((await call('abc')).status).toBe(404);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('rolls back on an error and says nothing was sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.fileComplaint.mockRejectedValue(new Error('deadlock'));
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: 'server_error' });
    expect(sqlCalls()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('keeps a committed complaint available if AI analysis cannot be recorded', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.analyzeComplaint.mockRejectedValue(new Error('analysis table unavailable'));
    const res = await call();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ reference: 'CMP-1A2B3C4D' });
    expect(sqlCalls()).toEqual(['BEGIN', 'COMMIT']);
    await h.scheduled[0]();
    expect(log).toHaveBeenCalledWith(
      'Complaint AI analysis could not be recorded:',
      expect.any(Error),
    );
  });
});
