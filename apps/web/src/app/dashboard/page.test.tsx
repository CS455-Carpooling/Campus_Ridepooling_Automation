import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminHome: vi.fn(),
  getStudentHome: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('@/lib/home-data', () => ({
  getAdminHome: mocks.getAdminHome,
  getStudentHome: mocks.getStudentHome,
}));
vi.mock('@/lib/session', () => ({ verifySession: mocks.verifySession }));
vi.mock('@/components/home/AdminHome', () => ({
  AdminHome: () => <div>Operations dashboard</div>,
}));
vi.mock('@/components/home/StudentHome', () => ({
  StudentHome: () => <div>Rider dashboard</div>,
}));

import DashboardPage from './page';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminHome.mockResolvedValue({});
    mocks.getStudentHome.mockResolvedValue({});
  });

  it.each([
    ['student', 'Rider dashboard'],
    ['admin', 'Operations dashboard'],
  ] as const)('shows the notification centre for a %s', async (role, dashboardName) => {
    mocks.verifySession.mockResolvedValue({ role, userId: 'user-1' });
    render(await DashboardPage());

    expect(screen.getByText(dashboardName)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recent notifications' })).not.toBeInTheDocument();
  });
});
