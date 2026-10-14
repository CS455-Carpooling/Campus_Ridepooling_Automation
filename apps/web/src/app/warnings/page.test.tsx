import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  verifySession: vi.fn(),
  listPendingRiderWarnings: vi.fn(),
  hasCompletedProfileSetup: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  }),
}));

vi.mock('@/lib/session', () => ({ verifySession: h.verifySession }));
vi.mock('@/lib/warnings', () => ({ listPendingRiderWarnings: h.listPendingRiderWarnings }));
vi.mock('@/lib/profile-data', () => ({ hasCompletedProfileSetup: h.hasCompletedProfileSetup }));
vi.mock('next/navigation', () => ({
  redirect: h.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import WarningsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  h.verifySession.mockResolvedValue({
    userId: '6f1c2a5e-2222-4000-8000-000000000001',
    role: 'student',
  });
  h.listPendingRiderWarnings.mockResolvedValue([
    {
      id: 'warning-1',
      reasonCategory: 'harassment',
      issuedAt: '2026-10-13T12:00:00.000Z',
    },
  ]);
});

describe('/warnings', () => {
  it('renders warnings after signing in and opts out of its own warning redirect', async () => {
    render(await WarningsPage());
    expect(h.verifySession).toHaveBeenCalledWith({
      allowIncompleteProfile: true,
      allowWarningAcknowledgement: true,
    });
    expect(screen.getByText('Reason category: Harassment')).toBeInTheDocument();
  });

  it('redirects to profile setup after the final warning is acknowledged', async () => {
    h.listPendingRiderWarnings.mockResolvedValue([]);
    h.hasCompletedProfileSetup.mockResolvedValue(false);
    await expect(WarningsPage()).rejects.toThrow('NEXT_REDIRECT /profile');
  });

  it('redirects to dashboard after all warnings are acknowledged', async () => {
    h.listPendingRiderWarnings.mockResolvedValue([]);
    h.hasCompletedProfileSetup.mockResolvedValue(true);
    await expect(WarningsPage()).rejects.toThrow('NEXT_REDIRECT /dashboard');
  });
});
