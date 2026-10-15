import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  CHATBOT_GEMINI_TIMEOUT_MS,
  ChatbotGeminiRequestError,
  interpretChatbotRequest,
} from './chatbot-gemini';

const rideOptions = {
  hubs: [{ id: 'kanpur-central', name: 'Kanpur Central' }],
  campusPlaces: [{ id: 'hall-1', name: 'Hall 1' }],
  vehicleTypes: [{ id: 'car', name: 'Car', capacity: 4 }],
};

function modelResponse(payload: unknown, usageMetadata?: unknown) {
  return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    usageMetadata,
  });
}

const validIntent = {
  intent: 'search_rides',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-1',
  vehicleTypeId: 'car',
  direction: 'to_hub',
  departureStart: '2026-10-15T18:00:00+05:30',
  departureEnd: '2026-10-15T23:00:00+05:30',
  maxFareShare: 300,
  profileName: '',
  reply: '',
};

describe('Gemini chatbot intent interpreter', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends a bounded structured request and returns parsed intent and token usage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      modelResponse(validIntent, { promptTokenCount: 140, candidatesTokenCount: 48 }),
    );

    const result = await interpretChatbotRequest(
      'Find a car tomorrow evening to Kanpur Central',
      rideOptions,
      new Date('2026-10-14T12:00:00.000Z'),
    );

    expect(result).toEqual({
      intent: validIntent,
      inputTokens: 140,
      outputTokens: 48,
    });
    const [url, request] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/models/gemini-');
    expect(request?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    expect(CHATBOT_GEMINI_TIMEOUT_MS).toBe(15000);

    const body = JSON.parse(String(request?.body));
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain('Untrusted request payload');
    expect(prompt).toContain('"riderMessage":"Find a car tomorrow evening to Kanpur Central"');
    expect(prompt).toContain('"currentDateTimeIST":"2026-10-14T17:30:00+05:30"');
    expect(prompt).not.toContain('test-key');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('rejects malformed or out-of-contract model output', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(modelResponse({ ...validIntent, intent: 'join_ride' }));

    await expect(
      interpretChatbotRequest('Join ride 42', rideOptions, new Date('2026-10-14T12:00:00Z')),
    ).rejects.toThrow('invalid chatbot intent');
  });

  it('preserves the provider HTTP status for server-side diagnostics', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(
      interpretChatbotRequest('Find a ride', rideOptions, new Date('2026-10-14T12:00:00Z')),
    ).rejects.toMatchObject<Partial<ChatbotGeminiRequestError>>({
      name: 'ChatbotGeminiRequestError',
      status: 404,
    });
  });

  it('does not call Gemini when the server API key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    await expect(
      interpretChatbotRequest('Find a ride', rideOptions, new Date('2026-10-14T12:00:00Z')),
    ).rejects.toThrow('not configured');
    expect(fetch).not.toHaveBeenCalled();
  });
});
