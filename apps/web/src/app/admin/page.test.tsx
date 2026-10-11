import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: mocks.requireAdminPage }));

import AdminIndexPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/admin (US-OA-19)', () => {
  it('sends an admin to their home, the dashboard', async () => {
    mocks.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
    await expect(AdminIndexPage()).rejects.toThrow('redirect:/dashboard');
  });

  it('tells a student the admin pages are not for them', async () => {
    mocks.requireAdminPage.mockResolvedValue(null);
    render(await AdminIndexPage());
    expect(
      screen.getByRole('heading', { level: 1, name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
  });
});
