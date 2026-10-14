import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ pool: { connect: mocks.connect } }));
vi.mock('@/lib/payment-settlement', () => ({ sendDuePaymentReminders: mocks.send }));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PAYMENT_REMINDER_CRON_SECRET', 'scheduler-test-secret');
  mocks.connect.mockResolvedValue({
    query: vi.fn(async () => ({ rows: [] })),
    release: vi.fn(),
  });
  mocks.send.mockResolvedValue(2);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/cron/payment-reminders', () => {
  it('rejects missing or incorrect bearer secrets', async () => {
    expect((await POST(new Request('http://local'))).status).toBe(401);
    expect(
      (
        await POST(
          new Request('http://local', {
            method: 'POST',
            headers: { Authorization: 'Bearer incorrect' },
          }),
        )
      ).status,
    ).toBe(401);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('runs transactionally with the configured bearer secret', async () => {
    const response = await POST(
      new Request('http://local', {
        method: 'POST',
        headers: { Authorization: 'Bearer scheduler-test-secret' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 2 });
    const client = await mocks.connect.mock.results[0]?.value;
    const statements = client.query.mock.calls as Array<[string, ...unknown[]]>;
    expect(statements.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(mocks.send).toHaveBeenCalledWith(client, expect.any(Date));
  });

  it('refuses to run when the scheduler is not configured', async () => {
    vi.stubEnv('PAYMENT_REMINDER_CRON_SECRET', '');
    const response = await POST(
      new Request('http://local', {
        method: 'POST',
        headers: { Authorization: 'Bearer scheduler-test-secret' },
      }),
    );
    expect(response.status).toBe(503);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
