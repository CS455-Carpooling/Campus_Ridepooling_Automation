// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  readJson: vi.fn(),
  withAdminAction: vi.fn(),
  listOpenChatComplaints: vi.fn(),
  resolveChatComplaint: vi.fn(),
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
vi.mock('@/lib/ride-chat', () => ({
  listOpenChatComplaints: h.listOpenChatComplaints,
  resolveChatComplaint: h.resolveChatComplaint,
}));

import { GET, PATCH } from './route';

const admin = { userId: '6f1c2a5e-0000-4000-8000-0000000000aa', role: 'admin' };
const CLIENT = { query: vi.fn() };
const patch = () => PATCH(new Request('http://localhost', { method: 'PATCH' }));

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminApi.mockResolvedValue({ admin });
  h.withAdminAction.mockImplementation(async (_admin, _meta, run) => run(CLIENT));
  h.readJson.mockResolvedValue({ reference: 'chat-12345678' });
  h.listOpenChatComplaints.mockResolvedValue([]);
  h.resolveChatComplaint.mockResolvedValue(true);
});

describe('/api/admin/chat-reports', () => {
  it('answers with the admin check refusal for anyone else', async () => {
    h.requireAdminApi
      .mockResolvedValueOnce({ response: Response.json({}, { status: 401 }) })
      .mockResolvedValueOnce({ response: Response.json({}, { status: 403 }) });
    expect((await GET()).status).toBe(401);
    expect((await patch()).status).toBe(403);
    expect(h.requireAdminApi).toHaveBeenNthCalledWith(1);
    expect(h.requireAdminApi).toHaveBeenNthCalledWith(2, { write: true });
    expect(h.resolveChatComplaint).not.toHaveBeenCalled();
  });

  it('lists open reports for administrators', async () => {
    h.listOpenChatComplaints.mockResolvedValue([{ reference: 'chat-12345678' }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reports: [{ reference: 'chat-12345678' }] });
  });

  it('resolves a report in the audited transaction (SYS-FR-45)', async () => {
    const response = await patch();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reference: 'chat-12345678', status: 'resolved' });
    expect(h.withAdminAction.mock.calls[0][1]).toEqual({
      action: 'chat_report.resolve',
      entityType: 'chat_report',
      entityId: 'chat-12345678',
    });
    expect(h.resolveChatComplaint).toHaveBeenCalledWith('chat-12345678', CLIENT);
  });

  it('refuses an invalid reference before any change, and a report that is not open', async () => {
    h.readJson.mockResolvedValueOnce({ reference: 'invalid' });
    expect((await patch()).status).toBe(400);
    expect(h.withAdminAction).not.toHaveBeenCalled();

    h.resolveChatComplaint.mockResolvedValueOnce(false);
    const response = await patch();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Open complaint not found.',
      code: 'not_found',
    });
  });
});
