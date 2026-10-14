import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  guard: vi.fn(),
  connect: vi.fn(),
  change: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.currentUser,
  guard: mocks.guard,
  json: (body: object, status = 200) => Response.json(body, { status }),
  readJson: async (req: Request) => req.json(),
}));
vi.mock('@/lib/db', () => ({ pool: { connect: mocks.connect } }));
vi.mock('@/lib/payment-settlement', () => ({ changeSettlement: mocks.change }));

import { POST } from './route';

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const SEAT = '7a2b3c4d-3333-4000-8000-000000000003';
const OWNER = '6f1c2a5e-2222-4000-8000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue(null);
  mocks.currentUser.mockResolvedValue({ id: OWNER });
  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    void sql;
    void values;
    return { rows: [] };
  });
  mocks.connect.mockResolvedValue({ query, release: vi.fn() });
});

const context = { params: Promise.resolve({ id: RIDE, occupantId: SEAT }) };

describe('POST settlement', () => {
  it('rejects invalid methods/references before opening a transaction', async () => {
    const response = await POST(
      new Request('http://local', {
        method: 'POST',
        body: JSON.stringify({ action: 'paid', method: 'card' }),
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('persists an authorized action and returns only its status', async () => {
    mocks.change.mockResolvedValue({ kind: 'done', status: 'confirmed' });
    const response = await POST(
      new Request('http://local', { method: 'POST', body: JSON.stringify({ action: 'confirm' }) }),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'confirmed' });
    expect(mocks.change).toHaveBeenCalledWith(
      expect.anything(),
      RIDE,
      SEAT,
      OWNER,
      { type: 'confirm' },
      expect.any(Date),
    );
  });

  it('does not commit a domain refusal', async () => {
    mocks.change.mockResolvedValue({ kind: 'not_owner' });
    const response = await POST(
      new Request('http://local', { method: 'POST', body: JSON.stringify({ action: 'confirm' }) }),
      context,
    );
    expect(response.status).toBe(403);
    const client = await mocks.connect.mock.results[0].value;
    const statements = client.query.mock.calls as Array<[string, ...unknown[]]>;
    expect(statements.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
  });
});
