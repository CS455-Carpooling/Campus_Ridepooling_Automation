import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ requireAdminPage: vi.fn(), listAiDecisionHistory: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: h.requireAdminPage }));
vi.mock('@/lib/admin-complaint-queries', () => ({
  listAiDecisionHistory: h.listAiDecisionHistory,
}));

import AdminAiDecisionsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
  h.listAiDecisionHistory.mockResolvedValue([
    {
      id: 'd1',
      analysisId: 'a1',
      complaintId: 'c1',
      complaintReference: 'CMP-1A2B3C4D',
      accusedId: 'u1',
      accusedName: 'Rohan',
      analysisSummary: 'A report describes unsafe driving.',
      recommendedAction: 'suspension',
      recommendedSuspensionDays: 30,
      recommendedIndefinite: false,
      decision: 'overridden',
      reason: 'Warning is proportionate.',
      finalAction: 'warning',
      warningId: 'w1',
      suspensionId: null,
      decidedAt: '2026-10-11T04:00:00.000Z',
      decidedBy: 'Ops Admin',
    },
  ]);
});

describe('/admin/ai-decisions (SYS-FR-38)', () => {
  it('shows the recommendation, decision, final action and authorized admin', async () => {
    render(await AdminAiDecisionsPage());
    expect(screen.getByRole('heading', { name: 'AI decision history' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CMP-1A2B3C4D' })).toHaveAttribute(
      'href',
      '/admin/complaints/c1',
    );
    expect(screen.getByRole('link', { name: 'Rohan' })).toHaveAttribute('href', '/admin/riders/u1');
    expect(screen.getByText(/Recommendation: Suspension \(30 days\)/)).toBeInTheDocument();
    expect(screen.getByText(/Decision: overridden/)).toBeInTheDocument();
    expect(screen.getByText('A report describes unsafe driving.')).toBeInTheDocument();
    expect(screen.getByText('Decided by Ops Admin')).toBeInTheDocument();
  });

  it('does not query decision history for a non-admin', async () => {
    h.requireAdminPage.mockResolvedValue(null);
    render(await AdminAiDecisionsPage());
    expect(
      screen.getByRole('heading', { name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
    expect(h.listAiDecisionHistory).not.toHaveBeenCalled();
  });
});
