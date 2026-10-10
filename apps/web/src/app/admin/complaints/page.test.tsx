import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOpenChatComplaints: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/ride-chat', () => ({ listOpenChatComplaints: mocks.listOpenChatComplaints }));

import AdminComplaintsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
  mocks.listOpenChatComplaints.mockResolvedValue([]);
});

describe('/admin/complaints', () => {
  it('redirects signed-out users to sign in', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    await expect(AdminComplaintsPage()).rejects.toThrow('redirect:/login');
  });

  it('redirects non-admin users to the dashboard', async () => {
    mocks.getSession.mockResolvedValueOnce({ userId: 'student-1', role: 'student' });
    await expect(AdminComplaintsPage()).rejects.toThrow('redirect:/dashboard');
  });

  it('loads the complaint queue for administrators', async () => {
    const page = await AdminComplaintsPage();
    expect(page.props.initialReports).toEqual([]);
    expect(mocks.listOpenChatComplaints).toHaveBeenCalledOnce();
  });
});
