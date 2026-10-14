// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../db', () => ({
  pool: { query: h.query },
}));

import {
  createPseudonymousRiderId,
  logChatbotAudit,
  purgeExpiredChatbotAudits,
  listChatbotAudits,
} from './chatbot-audit';

describe('Chatbot Audit Logging (AI-RD-12, P-28, FR-RD-05.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.query.mockResolvedValue({ rowCount: 1, rows: [] });
  });

  describe('createPseudonymousRiderId', () => {
    it('produces a consistent pseudonymous rider ID without disclosing user UUID', () => {
      const userId = '11111111-1111-4000-8000-111111111111';
      const pseudonym1 = createPseudonymousRiderId(userId);
      const pseudonym2 = createPseudonymousRiderId(userId);

      expect(pseudonym1).toBe(pseudonym2);
      expect(pseudonym1).toMatch(/^rider-[a-f0-9]{10}$/);
      expect(pseudonym1).not.toContain(userId);
    });

    it('produces distinct pseudonyms for different users', () => {
      const u1 = '11111111-1111-4000-8000-111111111111';
      const u2 = '22222222-2222-4000-8000-222222222222';
      expect(createPseudonymousRiderId(u1)).not.toBe(createPseudonymousRiderId(u2));
    });
  });

  describe('purgeExpiredChatbotAudits (90-Day Retention, P-28)', () => {
    it('executes SQL cleanup for records older than 90 days', async () => {
      h.query.mockResolvedValueOnce({ rowCount: 5, rows: [] });
      const purged = await purgeExpiredChatbotAudits();

      expect(purged).toBe(5);
      expect(h.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE created_at < now() - interval '90 days'"),
      );
    });
  });

  describe('logChatbotAudit', () => {
    const validParams = {
      requestId: '11111111-1111-4000-8000-111111111111',
      userId: '22222222-2222-4000-8000-222222222222',
      modelVersion: 'campus-ai-v1',
      promptVersion: '1.0',
      toolCalls: [
        {
          tool: 'search_rides',
          arguments: { hubId: 'kanpur-central', direction: 'to_hub' },
          resultSize: 4,
          success: true,
        },
      ],
      outcome: 'search_results',
      validationOutcome: 'valid',
      fallbackUsed: false,
      latencyMs: 145,
    };

    it('purges expired audits and inserts audit record with tool arguments, result size, and validation outcome', async () => {
      await logChatbotAudit(validParams);

      // Verify 90-day purge is called
      expect(h.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE created_at < now() - interval '90 days'"),
      );

      // Verify INSERT into chatbot_audits
      expect(h.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatbot_audits'),
        expect.arrayContaining([
          validParams.requestId,
          validParams.userId,
          'campus-ai-v1',
          '1.0',
          JSON.stringify(validParams.toolCalls),
          'search_results',
          'valid',
          false,
          145,
          null,
          null,
        ]),
      );
    });

    it('rejects logging when requestId or userId is not a valid UUID', async () => {
      await logChatbotAudit({
        ...validParams,
        requestId: 'invalid-id',
      });
      expect(h.query).not.toHaveBeenCalled();
    });

    it('does not throw when database query fails (non-blocking for rider requests)', async () => {
      h.query.mockRejectedValueOnce(new Error('DB Connection Refused'));
      await expect(logChatbotAudit(validParams)).resolves.not.toThrow();
    });
  });

  describe('listChatbotAudits', () => {
    it('returns formatted audit records with pseudonymous rider IDs', async () => {
      const rawRow = {
        request_id: '11111111-1111-4000-8000-111111111111',
        user_id: '22222222-2222-4000-8000-222222222222',
        model_version: 'campus-ai-v1',
        prompt_version: '1.0',
        tool_calls: [
          {
            tool: 'search_rides',
            arguments: { hubId: 'kanpur-central' },
            resultSize: 2,
            success: true,
          },
        ],
        outcome: 'search_results',
        validation_outcome: 'valid',
        fallback_used: false,
        latency_ms: 85,
        input_tokens: null,
        output_tokens: null,
        created_at: new Date('2026-10-14T10:00:00Z'),
      };

      h.query.mockResolvedValueOnce({ rows: [rawRow] });

      const records = await listChatbotAudits(20);
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        requestId: rawRow.request_id,
        pseudonymousRiderId: expect.stringMatching(/^rider-[a-f0-9]{10}$/),
        modelVersion: 'campus-ai-v1',
        validationOutcome: 'valid',
        fallbackUsed: false,
        latencyMs: 85,
        toolCalls: rawRow.tool_calls,
      });
    });
  });
});
