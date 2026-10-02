import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';
import HomePage from './page';

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn<() => Promise<Session>>(),
  getStudentHome: vi.fn(),
  getAdminHome: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ verifySession: mocks.verifySession }));
vi.mock('@/lib/home-data', () => ({
  getStudentHome: mocks.getStudentHome,
  getAdminHome: mocks.getAdminHome,
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStudentHome.mockResolvedValue({ upcoming: [], waiting: [] });
    mocks.getAdminHome.mockResolvedValue({
      openIncidents: null,
      complaintsToReview: null,
      recommendationsToDecide: null,
    });
  });

  it('shows students their rides', async () => {
    mocks.verifySession.mockResolvedValue({
      userId: 'u1',
      email: 'ananya@example.org',
      displayName: 'Ananya',
      role: 'student',
    });
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1, name: 'Your rides' })).toBeInTheDocument();
    expect(mocks.getStudentHome).toHaveBeenCalledWith('u1');
    expect(mocks.getAdminHome).not.toHaveBeenCalled();
  });

  it('shows operations admins their queues', async () => {
    mocks.verifySession.mockResolvedValue({
      userId: 'a1',
      email: 'khushi@example.org',
      displayName: 'Khushi',
      role: 'admin',
    });
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toBeInTheDocument();
    expect(mocks.getStudentHome).not.toHaveBeenCalled();
  });

  it('does not render anything when the session check redirects', async () => {
    mocks.verifySession.mockRejectedValue(new Error('NEXT_REDIRECT /login'));
    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT /login');
    expect(mocks.getStudentHome).not.toHaveBeenCalled();
    expect(mocks.getAdminHome).not.toHaveBeenCalled();
  });
});
