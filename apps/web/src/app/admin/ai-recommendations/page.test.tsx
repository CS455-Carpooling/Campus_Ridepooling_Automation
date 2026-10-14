import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ requireAdminPage: vi.fn(), listRecommendationAudits: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: h.requireAdminPage }));
vi.mock('@/lib/admin-recommendation-audits', () => ({
  listRecommendationAudits: h.listRecommendationAudits,
}));

import AdminAiRecommendationsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminPage.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
  h.listRecommendationAudits.mockResolvedValue([
    {
      requestId: 'request-1',
      riderPseudonym: '0123456789abcdef'.repeat(4),
      modelVersion: 'gemini-test',
      promptVersion: 'ride-ranking-v1',
      outcome: 'fallback_invalid',
      validationOutcome: 'failed',
      fallbackUsed: true,
      toolCallCount: 0,
      latencyMs: 125,
      inputTokens: 30,
      outputTokens: null,
      createdAt: '2026-10-12T00:00:00.000Z',
      reports: [
        {
          id: 'report-1',
          rideId: 'ride-1',
          reason: 'wrong',
          createdAt: '2026-10-12T00:01:00.000Z',
        },
      ],
    },
  ]);
});

describe('/admin/ai-recommendations', () => {
  it('shows operational metadata and reports with only a shortened pseudonym', async () => {
    render(await AdminAiRecommendationsPage());
    expect(
      screen.getByRole('heading', { name: 'AI recommendation oversight' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Request request-1')).toBeInTheDocument();
    expect(screen.getByText(/Rider pseudonym: 0123456789ab…/)).toBeInTheDocument();
    expect(screen.getByText('gemini-test / ride-ranking-v1')).toBeInTheDocument();
    expect(screen.getByText('0 (none are configured)')).toBeInTheDocument();
    expect(screen.getByText(/Wrong recommendation · Ride ride-1/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@|phone|email/i);
  });

  it('does not query audit data for a non-admin', async () => {
    h.requireAdminPage.mockResolvedValue(null);
    render(await AdminAiRecommendationsPage());
    expect(
      screen.getByRole('heading', { name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
    expect(h.listRecommendationAudits).not.toHaveBeenCalled();
  });
});
