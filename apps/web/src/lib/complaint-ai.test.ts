// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('./db', () => ({ pool: { query: h.query } }));

import { analyzeComplaint } from './complaint-ai';

const COMPLAINT = 'c0c0c0c0-1111-4000-8000-000000000001';
const context = {
  id: COMPLAINT,
  category: 'safety',
  description: 'The driver was speeding and refused to slow down.',
  accused_id: '6f1c2a5e-2222-4000-8000-000000000001',
  created_at: new Date('2026-10-11T00:00:00.000Z'),
  prior_complaints: [],
  warning_count: 0,
  suspension_count: 0,
  currently_suspended: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GEMINI_MODEL', '');
  h.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT 1 FROM complaint_ai_analyses')) return { rows: [] };
    if (sql.includes('FROM complaints c')) return { rows: [context] };
    return { rows: [] };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('analyzeComplaint (SYS-FR-30 to 33, 46, 47)', () => {
  it('records a manual-review fallback when Gemini is not configured', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await analyzeComplaint(COMPLAINT);
    const insert = h.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO complaint_ai_analyses'),
    );
    expect(insert?.[1]?.slice(0, 9)).toEqual([
      COMPLAINT,
      'fallback_service_error',
      null,
      null,
      [],
      null,
      null,
      false,
      null,
    ]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it('sends bounded complaint context to Gemini and persists validated JSON only', async () => {
    const analysis = {
      summary: 'The report describes unsafe driving.',
      severity: 'high',
      behaviorTags: ['safety_risk'],
      recommendedAction: 'warning',
      recommendedSuspensionDays: null,
      recommendedIndefinite: false,
      confidence: 0.9,
    };
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40 },
      }),
    );
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', fetch);
    await analyzeComplaint(COMPLAINT);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1beta/models/gemini-2.5-flash:generateContent');
    expect(new Headers(options.headers).get('x-goog-api-key')).toBe('test-key');
    const body = JSON.parse(String(options.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
      generationConfig: { maxOutputTokens: number; responseMimeType: string };
    };
    expect(body.generationConfig).toEqual({
      responseMimeType: 'application/json',
      maxOutputTokens: 512,
    });
    expect(body.contents[0].parts[0].text).toContain(context.description);
    expect(body.contents[0].parts[0].text).not.toContain(context.accused_id);

    const insert = h.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO complaint_ai_analyses'),
    );
    expect(insert?.[1]?.slice(0, 9)).toEqual([
      COMPLAINT,
      'ai_validated',
      analysis.summary,
      analysis.severity,
      ['safety_risk'],
      'warning',
      null,
      false,
      0.9,
    ]);
    expect(insert?.[1]?.[12]).toBe(120);
    expect(insert?.[1]?.[13]).toBe(40);
  });

  it('redacts email addresses and 10-digit numbers from current and prior complaint text sent to Gemini', async () => {
    const sensitiveContext = {
      ...context,
      description: 'Contact alex@example.com or call 9876543210 about the incident.',
      prior_complaints: [
        {
          category: 'safety',
          status: 'resolved',
          description: 'The other rider gave me rider.name@iitk.ac.in and 9123456789.',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    };
    h.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT 1 FROM complaint_ai_analyses')) return { rows: [] };
      if (sql.includes('FROM complaints c')) return { rows: [sensitiveContext] };
      return { rows: [] };
    });
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'The report describes a safety concern.',
                      severity: 'medium',
                      behaviorTags: ['safety_risk'],
                      recommendedAction: 'none',
                      recommendedSuspensionDays: null,
                      recommendedIndefinite: false,
                      confidence: 0.9,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );

    await analyzeComplaint(COMPLAINT);
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const request = JSON.parse(String(options.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    const prompt = request.contents[0].parts[0].text;

    expect(prompt).toContain('[redacted email]');
    expect(prompt).toContain('[redacted 10-digit number]');
    expect(prompt).not.toContain('alex@example.com');
    expect(prompt).not.toContain('9876543210');
    expect(prompt).not.toContain('rider.name@iitk.ac.in');
    expect(prompt).not.toContain('9123456789');
    expect(context.description).not.toContain('[redacted');
  });

  it('does not overwrite or duplicate an already analyzed complaint', async () => {
    h.query.mockImplementation(async () => ({ rows: [{ '?column?': 1 }] }));
    await analyzeComplaint(COMPLAINT);
    expect(h.query).toHaveBeenCalledOnce();
  });
});
