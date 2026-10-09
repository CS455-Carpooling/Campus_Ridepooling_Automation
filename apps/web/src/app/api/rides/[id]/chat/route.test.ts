import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
}));
const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: auth.guard,
  getCurrentUser: auth.getCurrentUser,
  readJson: auth.readJson,
  json: auth.json,
}));
vi.mock('@/lib/db', () => ({
  pool: { query: db.query },
}));
vi.mock('@/lib/ride-chat', () => ({
  getRideChatThread: vi.fn(),
  createChatMessage: vi.fn(),
  reportChatMessage: vi.fn(),
}));
vi.mock('@/lib/ids', () => ({ isUuid: (value: string) => /^[0-9a-f-]{36}$/i.test(value) }));

import { GET, POST } from './route';
import { createChatMessage, getRideChatThread, reportChatMessage } from '@/lib/ride-chat';

beforeEach(() => {
  vi.clearAllMocks();
  auth.guard.mockResolvedValue(null);
  auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  auth.readJson.mockResolvedValue({ message: 'hello' });
  db.query.mockResolvedValue({ rows: [] });
  vi.mocked(getRideChatThread).mockResolvedValue(null);
  vi.mocked(createChatMessage).mockResolvedValue({
    ok: true,
    message: {
      id: 'm-1',
      senderId: 'user-1',
      senderName: 'You',
      body: 'hello',
      createdAt: '2026-10-10T06:00:00.000Z',
      isMine: true,
      reported: false,
    },
  });
  vi.mocked(reportChatMessage).mockResolvedValue({ ok: true, reference: 'chat-m-1' });
});

describe('GET /api/rides/[id]/chat', () => {
  it('requires a signed-in member', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    const response = await GET(new Request('http://localhost/api/rides/ride-1/chat'), {
      params: Promise.resolve({ id: '0b9a7c1e-1111-4000-8000-000000000001' }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required.' });
  });

  it('returns the thread for a valid member and hides the route for others', async () => {
    vi.mocked(getRideChatThread).mockResolvedValue({
      id: 'chat-1',
      rideId: '0b9a7c1e-1111-4000-8000-000000000001',
      openedAt: '2026-10-10T06:00:00.000Z',
      readOnly: false,
      canWrite: true,
      messages: [],
    });
    const response = await GET(new Request('http://localhost/api/rides/ride-1/chat'), {
      params: Promise.resolve({ id: '0b9a7c1e-1111-4000-8000-000000000001' }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).thread.id).toBe('chat-1');
  });

  it('returns a closed-chat response for a ride member without passing extra SQL parameters', async () => {
    const rideId = '0b9a7c1e-1111-4000-8000-000000000001';
    db.query
      .mockResolvedValueOnce({ rows: [{ id: rideId }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });

    const response = await GET(new Request(`http://localhost/api/rides/${rideId}/chat`), {
      params: Promise.resolve({ id: rideId }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      thread: null,
      message: 'Pool chat opens once the ride locks.',
    });
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SELECT owner_id AS user_id FROM rides WHERE id = $1'),
      [rideId],
    );
  });
});

describe('POST /api/rides/[id]/chat', () => {
  it('rejects a missing message body', async () => {
    auth.readJson.mockResolvedValue({} as never);
    db.query.mockResolvedValue({ rows: [{ user_id: 'user-1' }] });
    const response = await POST(new Request('http://localhost/api/rides/ride-1/chat', { method: 'POST' }), {
      params: Promise.resolve({ id: '0b9a7c1e-1111-4000-8000-000000000001' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'A message is required.' });
  });

  it('sends a message when a current member posts', async () => {
    db.query.mockResolvedValue({ rows: [{ user_id: 'user-1' }] });
    const response = await POST(new Request('http://localhost/api/rides/ride-1/chat', { method: 'POST' }), {
      params: Promise.resolve({ id: '0b9a7c1e-1111-4000-8000-000000000001' }),
    });
    expect(response.status).toBe(200);
    expect(vi.mocked(createChatMessage)).toHaveBeenCalledWith(
      '0b9a7c1e-1111-4000-8000-000000000001',
      'user-1',
      'hello',
    );
    expect((await response.json()).message.body).toBe('hello');
  });

  it('reports a problematic message with a reference', async () => {
    auth.readJson.mockResolvedValue({ action: 'report', messageId: 'm-7', reason: 'Spam' });
    db.query.mockResolvedValue({ rows: [{ user_id: 'user-1' }] });
    const response = await POST(new Request('http://localhost/api/rides/ride-1/chat', { method: 'POST' }), {
      params: Promise.resolve({ id: '0b9a7c1e-1111-4000-8000-000000000001' }),
    });
    expect(response.status).toBe(200);
    expect(vi.mocked(reportChatMessage)).toHaveBeenCalledWith(
      '0b9a7c1e-1111-4000-8000-000000000001',
      'user-1',
      'm-7',
      'Spam',
    );
    expect((await response.json()).reference).toBe('chat-m-1');
  });
});
