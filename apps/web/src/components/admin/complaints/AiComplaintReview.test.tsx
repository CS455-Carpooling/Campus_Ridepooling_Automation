import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComplaintAiHistoryEntry } from '@/lib/admin-complaint-queries';
import { AiComplaintReview } from './AiComplaintReview';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const history: ComplaintAiHistoryEntry[] = [
  {
    id: 'analysis-1',
    outcome: 'ai_validated',
    summary: 'The report describes a safety concern.',
    severity: 'high',
    behaviorTags: ['safety_risk'],
    recommendedAction: 'warning',
    recommendedSuspensionDays: null,
    recommendedIndefinite: false,
    confidence: 0.9,
    createdAt: '2026-10-11T05:00:00.000Z',
    decision: null,
  },
];

const reply = (status: number, body: object) =>
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(body, { status }));

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderReview(resolved = false) {
  render(<AiComplaintReview complaintId="complaint-1" history={history} resolved={resolved} />);
}

describe('AiComplaintReview (OA-FR-34, OA-FR-36, CS455-56, CS455-57)', () => {
  it('checks required enforcement reason before sending a decision', async () => {
    renderReview();
    await userEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    expect(await screen.findByText('Give a reason for issuing a warning.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('checks a suspension length before sending', async () => {
    renderReview();
    await userEvent.selectOptions(screen.getByLabelText('Final action'), 'suspension');
    await userEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    expect(
      await screen.findByText(
        'Choose a suspension from 1 to 3650 days, or explicitly select indefinite.',
      ),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires a reason to reject an AI recommendation', async () => {
    renderReview();
    await userEvent.selectOptions(screen.getByLabelText('Decision'), 'rejected');
    await userEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    expect(
      await screen.findByText('A reason is required to reject or override a recommendation.'),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the server recommendation-mismatch refusal', async () => {
    renderReview();
    await userEvent.selectOptions(screen.getByLabelText('Final action'), 'none');
    reply(400, {
      error: 'Reload the page and use the current recommendation.',
      code: 'recommendation_mismatch',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Reload the page and use the current recommendation.',
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('refreshes after the server reports that the recommendation was already decided', async () => {
    renderReview();
    await userEvent.type(screen.getByLabelText('Reason for enforcement action'), 'Reviewed');
    reply(409, {
      error: 'This AI recommendation already has a decision.',
      code: 'already_decided',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already has a decision');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('redirects to sign-in if the admin session has expired', async () => {
    renderReview();
    await userEvent.type(screen.getByLabelText('Reason for enforcement action'), 'Reviewed');
    reply(401, { error: 'Authentication required.', code: 'unauthenticated' });
    await userEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('does not show a decision form for a resolved complaint', () => {
    renderReview(true);
    expect(screen.getByText(/complaint is resolved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save decision' })).not.toBeInTheDocument();
  });
});
