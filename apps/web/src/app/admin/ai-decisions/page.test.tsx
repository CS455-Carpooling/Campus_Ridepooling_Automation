// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  listAiDecisionHistory: vi.fn(),
  listChatbotAudits: vi.fn(),
}));
vi.mock('../../../lib/admin-auth', () => ({ requireAdminPage: h.requireAdminPage }));
vi.mock('../../../lib/admin-complaint-queries', () => ({
  listAiDecisionHistory: h.listAiDecisionHistory,
}));
vi.mock('../../../lib/ai/chatbot-audit', () => ({
  listChatbotAudits: h.listChatbotAudits,
}));
vi.mock('../../../components/admin/AdminNotAllowed', () => ({
  AdminNotAllowed: () => <h1>This page is for operations admins</h1>,
}));
vi.mock('../../../components/admin/AdminPageShell', () => ({
  AdminPageShell: ({
    title,
    description,
    children,
  }: {
    title: string;
    description: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
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
  h.listChatbotAudits.mockResolvedValue([
    {
      requestId: 'req-1',
      pseudonymousRiderId: 'rider-abc1234567',
      userId: 'u1',
      modelVersion: 'campus-ai-v1',
      promptVersion: '1.0',
      toolCalls: [
        {
          tool: 'search_rides',
          arguments: { hubId: 'kanpur-central' },
          resultSize: 3,
          success: true,
        },
      ],
      outcome: 'search_results',
      validationOutcome: 'valid',
      fallbackUsed: false,
      latencyMs: 120,
      inputTokens: null,
      outputTokens: null,
      createdAt: '2026-10-11T05:00:00.000Z',
    },
  ]);
});

describe('/admin/ai-decisions (SYS-FR-38, AI-RD-12)', () => {
  it('shows the recommendation, decision, final action and authorized admin', async () => {
    const html = renderToStaticMarkup(await AdminAiDecisionsPage());
    expect(html).toContain('AI decision history');
    expect(html).toContain('CMP-1A2B3C4D');
    expect(html).toContain('Rohan');
    expect(html).toContain('Recommendation: Suspension (30 days)');
    expect(html).toContain('Decision: overridden');
    expect(html).toContain('A report describes unsafe driving.');
    expect(html).toContain('Decided by Ops Admin');
  });

  it('renders AI chatbot interaction audit records with pseudonymous rider ID, tools, and validation outcome (AI-RD-12)', async () => {
    const html = renderToStaticMarkup(await AdminAiDecisionsPage());
    expect(html).toContain('Chatbot interaction audit logs (AI-RD-12)');
    expect(html).toContain('rider-abc1234567');
    expect(html).toContain('search_rides');
    expect(html).toContain('(3 results)');
    expect(html).toContain('valid');
    expect(html).toContain('Direct');
    expect(html).toContain('120 ms');
  });

  it('does not query decision history or chatbot audits for a non-admin', async () => {
    h.requireAdminPage.mockResolvedValue(null);
    const html = renderToStaticMarkup(await AdminAiDecisionsPage());
    expect(html).toContain('This page is for operations admins');
    expect(h.listAiDecisionHistory).not.toHaveBeenCalled();
    expect(h.listChatbotAudits).not.toHaveBeenCalled();
  });
});
