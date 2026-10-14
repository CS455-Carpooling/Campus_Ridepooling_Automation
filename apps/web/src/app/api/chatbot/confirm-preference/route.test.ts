// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  readJson: vi.fn(),
  confirmPreferenceProposal: vi.fn(),
}));

vi.mock('../../../../lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  json: h.json,
  readJson: h.readJson,
}));

vi.mock('../../../../lib/ai/preference-proposals', () => ({
  confirmPreferenceProposal: h.confirmPreferenceProposal,
}));

import { POST } from './route';

const USER = {
  id: '11111111-1111-4000-8000-111111111111',
  email: 'rider@iitk.ac.in',
  fullName: 'Test Rider',
  rollNumber: '220101',
  role: 'student',
};
const PROPOSAL_ID = '33333333-3333-4000-8000-333333333333';

describe('POST /api/chatbot/confirm-preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.guard.mockResolvedValue(null);
    h.getCurrentUser.mockResolvedValue(USER);
  });

  it('rejects unauthenticated requests with 401', async () => {
    h.getCurrentUser.mockResolvedValue(null);

    const req = new Request('http://localhost/api/chatbot/confirm-preference', {
      method: 'POST',
      body: JSON.stringify({ proposalId: PROPOSAL_ID }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Authentication required.');
    expect(h.confirmPreferenceProposal).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid proposal IDs with 400', async () => {
    h.readJson.mockResolvedValue({ proposalId: 'not-a-uuid' });

    const req = new Request('http://localhost/api/chatbot/confirm-preference', {
      method: 'POST',
      body: JSON.stringify({ proposalId: 'not-a-uuid' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('valid proposal ID');
  });

  it('returns 400 when proposal has expired after 10 minutes (US-RD-14-AC2, AI-RD-04)', async () => {
    h.readJson.mockResolvedValue({ proposalId: PROPOSAL_ID });
    h.confirmPreferenceProposal.mockResolvedValue({
      success: false,
      error: 'This proposal has expired (unconfirmed proposals lapse after 10 minutes).',
    });

    const req = new Request('http://localhost/api/chatbot/confirm-preference', {
      method: 'POST',
      body: JSON.stringify({ proposalId: PROPOSAL_ID }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('This proposal has expired');
    expect(h.confirmPreferenceProposal).toHaveBeenCalledWith(PROPOSAL_ID, USER.id);
  });

  it('succeeds when confirmed within 10-minute window (US-RD-14-AC1)', async () => {
    h.readJson.mockResolvedValue({ proposalId: PROPOSAL_ID });
    h.confirmPreferenceProposal.mockResolvedValue({
      success: true,
    });

    const req = new Request('http://localhost/api/chatbot/confirm-preference', {
      method: 'POST',
      body: JSON.stringify({ proposalId: PROPOSAL_ID }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Preferences updated successfully.');
    expect(h.confirmPreferenceProposal).toHaveBeenCalledWith(PROPOSAL_ID, USER.id);
  });
});
