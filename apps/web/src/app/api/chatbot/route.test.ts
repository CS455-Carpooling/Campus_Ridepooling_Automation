// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  readJson: vi.fn(),
  processChatbotMessage: vi.fn(),
  logChatbotAudit: vi.fn(),
}));

vi.mock('../../../lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  rateLimit: h.rateLimit,
  json: h.json,
  readJson: h.readJson,
}));

vi.mock('../../../lib/ai/chatbot', () => ({
  processChatbotMessage: h.processChatbotMessage,
  MAX_MESSAGE_LENGTH: 500,
}));

vi.mock('../../../lib/ai/chatbot-audit', () => ({
  logChatbotAudit: h.logChatbotAudit,
}));

import { POST, CHATBOT_HOURLY_LIMIT } from './route';

const USER = {
  id: '11111111-1111-4000-8000-111111111111',
  email: 'rider@iitk.ac.in',
  fullName: 'Test Rider',
  rollNumber: '220101',
  role: 'student',
};

describe('POST /api/chatbot (Backend API Route & Guardrails)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.guard.mockResolvedValue(null);
    h.getCurrentUser.mockResolvedValue(USER);
    h.rateLimit.mockResolvedValue(true);
    h.logChatbotAudit.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated requests with 401', async () => {
    h.getCurrentUser.mockResolvedValue(null);

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: 'Find a ride to Lucknow' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Authentication required.');
    expect(h.processChatbotMessage).not.toHaveBeenCalled();
  });

  it('blocks request when origin guard triggers', async () => {
    h.guard.mockResolvedValue(Response.json({ error: 'Invalid origin' }, { status: 403 }));

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: 'Find a ride' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(h.getCurrentUser).not.toHaveBeenCalled();
  });

  it('enforces 20 requests/hour per rider limit and records rate_limited audit (AI-RD-09)', async () => {
    h.rateLimit.mockResolvedValue(false); // Rate limit exceeded

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: 'Find rides to Lucknow' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.rateLimited).toBe(true);
    expect(data.error).toContain('20 requests per hour');
    expect(data.fallbackLink.href).toBe('/rides');

    expect(h.rateLimit).toHaveBeenCalledWith(
      `chatbot:rider:${USER.id}`,
      CHATBOT_HOURLY_LIMIT,
      3600,
    );
    expect(h.logChatbotAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER.id,
        outcome: 'rate_limited',
      }),
    );
    expect(h.processChatbotMessage).not.toHaveBeenCalled();
  });

  it('rejects empty or whitespace-only messages with 400', async () => {
    h.readJson.mockResolvedValue({ message: '   ' });

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: '   ' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Message is required.');
  });

  it('rejects messages longer than 500 characters with 400 (AI-RD-09, FR-RD-05.4)', async () => {
    const longMsg = 'a'.repeat(501);
    h.readJson.mockResolvedValue({ message: longMsg });

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: longMsg }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('500-character limit');
  });

  it('processes search query, logs audit with tool calls, and returns structured result', async () => {
    const mockResponse = {
      kind: 'search_results',
      message: 'Found 2 matching rides.',
      interpretedFilters: {
        direction: 'to_hub',
        hubId: 'kanpur-central',
        hubName: 'Kanpur Central',
        campusLocationId: 'hall-1',
        campusLocationName: 'Hall 1',
        departureStart: '2026-10-15T08:00:00+05:30',
        departureEnd: '2026-10-15T10:00:00+05:30',
      },
      rides: [],
    };
    h.readJson.mockResolvedValue({ message: 'Need a ride to Kanpur Central tomorrow 8am' });
    h.processChatbotMessage.mockResolvedValue(mockResponse);

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: 'Need a ride to Kanpur Central tomorrow 8am' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.kind).toBe('search_results');
    expect(data.requestId).toBeDefined();

    expect(h.processChatbotMessage).toHaveBeenCalledWith(
      USER.id,
      'Need a ride to Kanpur Central tomorrow 8am',
    );
    expect(h.logChatbotAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER.id,
        outcome: 'search_results',
        toolCalls: [{ tool: 'search_rides', success: true }],
      }),
    );
  });

  it('handles preference proposal responses and logs propose_preference_update audit', async () => {
    const mockProposalResponse = {
      kind: 'preference_proposal',
      message: 'I have prepared a proposal to update your default pickup to Hall 7.',
      proposal: {
        id: '22222222-2222-4000-8000-222222222222',
        status: 'pending',
      },
    };
    h.readJson.mockResolvedValue({ message: 'Change my pickup to Hall 7' });
    h.processChatbotMessage.mockResolvedValue(mockProposalResponse);

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: 'Change my pickup to Hall 7' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.kind).toBe('preference_proposal');
    expect(h.logChatbotAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'preference_proposal',
        toolCalls: [{ tool: 'propose_preference_update', success: true }],
      }),
    );
  });

  it('returns graceful fallback and logs error if AI service encounters an unexpected error (FR-RD-05.7)', async () => {
    h.readJson.mockResolvedValue({ message: 'Show rides' });
    h.processChatbotMessage.mockRejectedValue(new Error('Downstream model failure'));

    const req = new Request('http://localhost/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message: 'Show rides' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.kind).toBe('service_unavailable');
    expect(data.fallbackLink.href).toBe('/rides');
    expect(h.logChatbotAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER.id,
        outcome: 'error',
      }),
    );
  });
});
