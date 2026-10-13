import { describe, expect, it } from 'vitest';
import { complaintCategoryLabels } from './complaint-rules';
import { formatDeparture } from './format';
import {
  ACTIVE_SUSPENSION_SQL,
  SUSPENSION_CATEGORY_LABELS,
  activeSuspension,
  suspensionRefusal,
} from './suspension-rule.mjs';

const USER = '6f1c2a5e-2222-4000-8000-000000000002';
const now = new Date('2026-10-13T12:00:00.000Z');

describe('the shared suspension rule (FR-RD-01.5, SYS-FR-25)', () => {
  it('reads the suspension in force at the given time, the longest first', () => {
    expect(ACTIVE_SUSPENSION_SQL).toContain('lifted_at IS NULL AND starts_at <= $2');
    expect(ACTIVE_SUSPENSION_SQL).toContain('(ends_at IS NULL OR ends_at > $2)');
    expect(ACTIVE_SUSPENSION_SQL).toContain(
      'ORDER BY is_indefinite DESC, ends_at DESC NULLS FIRST',
    );
  });

  it('gives until when and why, never the reason text', async () => {
    const calls: unknown[][] = [];
    const db = {
      query: async (_sql: string, values: unknown[]) => {
        calls.push(values);
        return {
          rows: [{ reason_category: 'harassment', ends_at: new Date('2026-10-15T12:30:00.000Z') }],
        };
      },
    };
    await expect(activeSuspension(db, USER, now)).resolves.toEqual({
      reasonCategory: 'harassment',
      endsAt: '2026-10-15T12:30:00.000Z',
    });
    expect(calls[0]).toEqual([USER, now]);
    await expect(activeSuspension({ query: async () => ({ rows: [] }) }, USER, now)).resolves.toBe(
      null,
    );
  });

  // The socket server cannot load format.ts or complaint-rules.ts, so the wording is kept in
  // step with them here.
  it.each(['2026-10-15T12:30:00.000Z', '2026-12-31T23:59:00.000Z', '2027-01-01T00:05:00.000Z'])(
    'words the refusal exactly as the app formats a time (%s)',
    (endsAt) => {
      expect(suspensionRefusal({ endsAt, reasonCategory: 'safety' }, 'offer a ride')).toBe(
        `Your account is suspended until ${formatDeparture(endsAt)} (IST) (reason: Safety), so you cannot offer a ride. You can still file a complaint.`,
      );
    },
  );

  it('names an indefinite suspension, and uses the complaint category labels', () => {
    expect(suspensionRefusal({ endsAt: null, reasonCategory: 'no_show' }, 'rate people')).toBe(
      'Your account is suspended until an operations admin lifts it (reason: No-show), so you cannot rate people. You can still file a complaint.',
    );
    expect(SUSPENSION_CATEGORY_LABELS).toEqual(complaintCategoryLabels);
  });
});
