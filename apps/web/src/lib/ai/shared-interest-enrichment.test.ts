// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));

import { enrichSharedInterests } from './shared-interest-enrichment';

const RIDER = '10000000-0000-4000-8000-000000000001';
const RIDE_A = '20000000-0000-4000-8000-000000000001';
const RIDE_B = '20000000-0000-4000-8000-000000000002';

beforeEach(() => vi.clearAllMocks());

describe('enrichSharedInterests', () => {
  it('does not query when there are no candidate rides', async () => {
    await expect(enrichSharedInterests(RIDER, [])).resolves.toEqual(new Map());
    expect(h.query).not.toHaveBeenCalled();
  });

  it('deduplicates candidate IDs and initializes missing rows as unavailable', async () => {
    h.query.mockResolvedValueOnce({ rows: [] });
    const result = await enrichSharedInterests(RIDER, [RIDE_A, RIDE_A, RIDE_B]);
    expect([...result.entries()]).toEqual([
      [RIDE_A, { sharedInterestTags: null }],
      [RIDE_B, { sharedInterestTags: null }],
    ]);
    expect(h.query).toHaveBeenCalledTimes(1);
    expect(h.query.mock.calls[0][1]).toEqual([RIDER, [RIDE_A, RIDE_B]]);
  });

  it('maps approved shared labels and leaves unreturned candidates unavailable', async () => {
    h.query.mockResolvedValueOnce({ rows: [{
      ride_id: RIDE_A,
      all_participants_consented: true,
      all_participants_have_visible_tags: true,
      shared_tag_names: ['Hobbies', 'Academic tracks', 'Hobbies'],
    }] });
    const result = await enrichSharedInterests(RIDER, [RIDE_A, RIDE_B]);
    expect(result.get(RIDE_A)).toEqual({ sharedInterestTags: ['Academic tracks', 'Hobbies'] });
    expect(result.get(RIDE_B)).toEqual({ sharedInterestTags: null });
  });

  it('withholds labels when any participant has not consented', async () => {
    h.query.mockResolvedValueOnce({ rows: [{
      ride_id: RIDE_A,
      all_participants_consented: false,
      all_participants_have_visible_tags: true,
      shared_tag_names: ['Hobbies'],
    }] });
    const result = await enrichSharedInterests(RIDER, [RIDE_A]);
    expect(result.get(RIDE_A)).toEqual({ sharedInterestTags: null });
  });

  it('distinguishes no common interest from missing visible-tag data', async () => {
    h.query.mockResolvedValueOnce({ rows: [
      { ride_id: RIDE_A, all_participants_consented: true,
        all_participants_have_visible_tags: true, shared_tag_names: null },
      { ride_id: RIDE_B, all_participants_consented: true,
        all_participants_have_visible_tags: false, shared_tag_names: ['Hobbies'] },
    ] });
    const result = await enrichSharedInterests(RIDER, [RIDE_A, RIDE_B]);
    expect(result.get(RIDE_A)).toEqual({ sharedInterestTags: [] });
    expect(result.get(RIDE_B)).toEqual({ sharedInterestTags: null });
  });
});
