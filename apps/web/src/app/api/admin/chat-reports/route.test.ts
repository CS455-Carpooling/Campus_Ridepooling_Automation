import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => vi.fn());
const queryHelpers = vi.hoisted(() => ({
  listOpenChatComplaints: vi.fn(),
  resolveChatComplaint: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  readJson: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: session }));
vi.mock('@/lib/ride-chat', () => queryHelpers);
vi.mock('@/lib/auth', () => auth);

import { GET, PATCH } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
  auth.readJson.mockResolvedValue({ reference: 'chat-12345678' });
  queryHelpers.listOpenChatComplaints.mockResolvedValue([]);
  queryHelpers.resolveChatComplaint.mockResolvedValue(true);
});

describe('/api/admin/chat-reports', () => {
  it('requires authentication and administrator role', async () => {
    session
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 'student-1', role: 'student' });
    expect((await GET()).status).toBe(401);
    expect((await GET()).status).toBe(403);
  });

  it('lists open reports for administrators', async () => {
    queryHelpers.listOpenChatComplaints.mockResolvedValue([{ reference: 'chat-12345678' }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reports: [{ reference: 'chat-12345678' }] });
  });

  it('validates, resolves, and reports missing complaint references', async () => {
    auth.readJson.mockResolvedValueOnce({ reference: 'invalid' });
    expect((await PATCH(new Request('http://localhost', { method: 'PATCH' }))).status).toBe(400);

    queryHelpers.resolveChatComplaint.mockResolvedValueOnce(false);
    expect((await PATCH(new Request('http://localhost', { method: 'PATCH' }))).status).toBe(404);

    const response = await PATCH(new Request('http://localhost', { method: 'PATCH' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reference: 'chat-12345678', status: 'resolved' });
  });
});
