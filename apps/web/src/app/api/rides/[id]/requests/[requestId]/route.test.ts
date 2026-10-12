// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  actOnJoinRequest: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: h.json,
}));
vi.mock('@/lib/db', () => ({ pool: { connect: h.connect } }));
vi.mock('@/lib/join-requests', () => ({ actOnJoinRequest: h.actOnJoinRequest }));

import { PATCH } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const REQUEST_ID = '8b3c4d5e-4444-4000-8000-000000000004';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

function call(body: unknown = { action: 'accept' }, ids = { id: RIDE_ID, requestId: REQUEST_ID }) {
  h.readJson.mockReset();
  h.readJson.mockResolvedValue(body);
  return PATCH(new Request('http://localhost', { method: 'PATCH' }), {
    params: Promise.resolve(ids),
  } as RouteContext<'/api/rides/[id]/requests/[requestId]'>);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.readJson.mockResolvedValue({ action: 'accept' });
  h.connect.mockResolvedValue({ query: h.clientQuery, release: h.release });
  h.clientQuery.mockResolvedValue({ rows: [] });
  h.actOnJoinRequest.mockResolvedValue({ kind: 'accepted' });
});

describe('PATCH /api/rides/[id]/requests/[requestId]', () => {
  it('honors rate limits, requires authentication, and validates both IDs', async () => {
    h.guard.mockResolvedValueOnce(Response.json({ error: 'Slow down.' }, { status: 429 }));
    expect((await call()).status).toBe(429);
    h.getCurrentUser.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(401);
    expect((await call({ action: 'accept' }, { id: 'bad', requestId: REQUEST_ID })).status).toBe(
      404,
    );
    expect((await call({ action: 'accept' }, { id: RIDE_ID, requestId: 'bad' })).status).toBe(404);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('rejects unsupported actions and non-boolean late confirmation before connecting', async () => {
    expect((await call({ action: 'not-an-action' })).status).toBe(400);
    expect((await call({ action: 'leave', confirmLate: 'yes' })).status).toBe(400);
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('commits successful transitions and reports their result', async () => {
    const response = await call({ action: 'accept' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { kind: 'accepted' } });
    expect(h.actOnJoinRequest).toHaveBeenCalledWith(
      expect.anything(),
      RIDE_ID,
      REQUEST_ID,
      USER_ID,
      'accept',
      expect.any(Date),
      false,
    );
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('rolls back known refusals and uses the supplied service detail for other refusals', async () => {
    h.actOnJoinRequest.mockResolvedValueOnce({ kind: 'not_owner' });
    const forbidden = await call({ action: 'reject' });
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error).toBe('Only the ride owner can decide requests.');

    h.actOnJoinRequest.mockResolvedValueOnce({ kind: 'conflict', detail: 'Custom refusal.' });
    const conflict = await call({ action: 'accept' });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'Custom refusal.', code: 'conflict' });
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'ROLLBACK',
      'BEGIN',
      'ROLLBACK',
    ]);
  });

  it('rolls back and returns a server error if the transaction fails', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.actOnJoinRequest.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('server_error');
    expect(h.clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(h.release).toHaveBeenCalledOnce();
    quiet.mockRestore();
  });
});
