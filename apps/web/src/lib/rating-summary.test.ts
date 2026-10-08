import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { OWN_COMMENTS_LIMIT, getOwnRating, publicRatingJoin } from './rating-summary';

const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';
const now = new Date('2026-10-14T12:00:00+05:30');

beforeEach(() => query.mockReset());

describe('publicRatingJoin (P-24)', () => {
  const sql = publicRatingJoin('m.user_id', '$3');

  it('US-RD-28 AC3: gives nothing below 3 ratings', () => {
    expect(sql).toContain('HAVING count(*) >= 3');
    expect(sql).toMatch(/^LEFT JOIN LATERAL/);
    expect(sql).toContain(') public_rating ON true');
  });

  it('counts only ratings whose ride has finished its 72 hours of rating', () => {
    expect(sql).toContain('rated.ratee_id = m.user_id');
    expect(sql).toContain('rated_ride.completed_at + make_interval(hours => 72) <= $3');
  });

  it('gives the average to one decimal and never reads who rated', () => {
    expect(sql).toContain('round(avg(rated.score), 1)::float8 AS rating_average');
    expect(sql).not.toContain('rater_id');
  });
});

describe('getOwnRating (CS455-44)', () => {
  it('has nothing for a user ID that is not a UUID, without a query', async () => {
    await expect(getOwnRating('dev-student', now)).resolves.toEqual({
      count: 0,
      average: null,
      comments: [],
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('US-RD-28 AC3: below 3 ratings, gives the count only, and reads no comments', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: 2, average: 4.5 }] });
    await expect(getOwnRating(USER_ID, now)).resolves.toEqual({
      count: 2,
      average: null,
      comments: [],
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([USER_ID, now]);
    expect(query.mock.calls[0][0]).toContain('make_interval(hours => 72) <= $2');
  });

  it('from 3 ratings, gives the average and the comments, newest ride first', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: 3, average: 4.3 }] });
    query.mockResolvedValueOnce({ rows: [{ comment: 'Always on time.' }, { comment: 'Kind.' }] });
    await expect(getOwnRating(USER_ID, now)).resolves.toEqual({
      count: 3,
      average: 4.3,
      comments: ['Always on time.', 'Kind.'],
    });
    const [commentsSql, params] = query.mock.calls[1];
    expect(params).toEqual([USER_ID, now, OWN_COMMENTS_LIMIT]);
    expect(commentsSql).toContain('ORDER BY rated_ride.completed_at DESC, rated.id');
    expect(commentsSql).toContain('rated.comment IS NOT NULL');
  });

  it('never reads who wrote a comment, the score, or when', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: 5, average: 3.8 }] });
    query.mockResolvedValueOnce({ rows: [] });
    await getOwnRating(USER_ID, now);
    for (const [sql] of query.mock.calls) expect(sql).not.toContain('rater_id');
    const commentsSql = query.mock.calls[1][0] as string;
    expect(commentsSql).toMatch(/SELECT rated\.comment\s+FROM/);
  });

  it('copes with an empty answer', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getOwnRating(USER_ID, now)).resolves.toEqual({
      count: 0,
      average: null,
      comments: [],
    });
  });
});
