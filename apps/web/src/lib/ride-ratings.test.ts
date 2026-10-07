import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { getRatingPage, submitRatings } from './ride-ratings';
import type { RatingEntry } from './rating-rules';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const VIEWER_ID = '6f1c2a5e-2222-4000-8000-000000000002';
const OWNER_ID = '6f1c2a5e-2222-4000-8000-000000000003';
const OTHER_ID = '6f1c2a5e-2222-4000-8000-000000000004';
const MY_SEAT = 'a1a1a1a1-3333-4000-8000-000000000001';
const OWNER_SEAT = 'a1a1a1a1-3333-4000-8000-000000000002';
const OTHER_SEAT = 'a1a1a1a1-3333-4000-8000-000000000003';

// Departure 06:30 IST on Saturday 10 October 2026, completed at 08:05, so rating closes
// at 08:05 IST on Tuesday 13 October.
const completedAt = new Date('2026-10-10T08:05:00+05:30');
const during = new Date('2026-10-11T12:00:00+05:30');
const after = new Date('2026-10-13T08:05:00+05:30');

function rideRow(change: Record<string, unknown> = {}) {
  return {
    id: RIDE_ID,
    direction: 'to_hub',
    state: 'completed',
    departure_start: new Date('2026-10-10T06:30:00+05:30'),
    departure_end: new Date('2026-10-10T07:30:00+05:30'),
    completed_at: completedAt,
    hub_name: 'Kanpur Central',
    viewer_is_owner: false,
    ...change,
  };
}

const ownerRow = {
  occupant_id: OWNER_SEAT,
  name: 'Ananya Rao',
  is_owner: true,
  campus_place: 'Hall 6',
  rated: true,
};
const otherRow = {
  occupant_id: OTHER_SEAT,
  name: 'Meera Iyer',
  is_owner: false,
  campus_place: 'Main Gate',
  rated: false,
};

beforeEach(() => query.mockReset());

describe('getRatingPage', () => {
  it('returns null for IDs that are not UUIDs, without a query', async () => {
    await expect(getRatingPage('abc', VIEWER_ID, during)).resolves.toBeNull();
    await expect(getRatingPage(RIDE_ID, 'dev-student', during)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns null for a missing ride or someone without a seat on it, reading nobody', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getRatingPage(RIDE_ID, VIEWER_ID, during)).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain(
      'JOIN riders me ON me.ride_id = r.id AND me.user_id = $2',
    );
    expect(query.mock.calls[0][1]).toEqual([RIDE_ID, VIEWER_ID]);
  });

  it('lists everyone else on the ride by seat, with whom the viewer has rated', async () => {
    query.mockResolvedValueOnce({ rows: [rideRow()] });
    query.mockResolvedValueOnce({ rows: [ownerRow, otherRow] });
    const page = await getRatingPage(RIDE_ID, VIEWER_ID, during);
    expect(page).toEqual({
      rideId: RIDE_ID,
      title: 'To Kanpur Central',
      direction: 'to_hub',
      departureStart: '2026-10-10T01:00:00.000Z',
      departureEnd: '2026-10-10T02:00:00.000Z',
      state: 'completed',
      window: 'open',
      completedAt: '2026-10-10T02:35:00.000Z',
      closesAt: '2026-10-13T02:35:00.000Z',
      viewerRole: 'rider',
      people: [
        {
          occupantId: OWNER_SEAT,
          name: 'Ananya Rao',
          isOwner: true,
          campusPlace: 'Hall 6',
          rated: true,
        },
        {
          occupantId: OTHER_SEAT,
          name: 'Meera Iyer',
          isOwner: false,
          campusPlace: 'Main Gate',
          rated: false,
        },
      ],
    });
    const peopleSql = query.mock.calls[1][0] as string;
    expect(peopleSql).toContain('m.user_id <> $2');
    expect(peopleSql).toContain('given.rater_id = $2');
  });

  it('US-RD-28 AC1: says when rating has closed, and when the ride is not completed', async () => {
    query.mockResolvedValueOnce({ rows: [rideRow({ viewer_is_owner: true })] });
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getRatingPage(RIDE_ID, VIEWER_ID, after)).resolves.toMatchObject({
      window: 'closed',
      viewerRole: 'owner',
      people: [],
    });

    query.mockResolvedValueOnce({ rows: [rideRow({ state: 'scheduled', completed_at: null })] });
    query.mockResolvedValueOnce({ rows: [otherRow] });
    await expect(getRatingPage(RIDE_ID, VIEWER_ID, during)).resolves.toMatchObject({
      window: 'not_completed',
      completedAt: null,
      closesAt: null,
    });
  });

  it('FR-RD-02.4: never reads user IDs, email, roll numbers, mobile numbers or scores', async () => {
    query.mockResolvedValueOnce({ rows: [rideRow()] });
    query.mockResolvedValueOnce({ rows: [ownerRow] });
    const page = await getRatingPage(RIDE_ID, VIEWER_ID, during);
    const peopleSql = query.mock.calls[1][0] as string;
    expect(peopleSql).not.toMatch(/user_id AS|email|roll_number|password|mobile|score/);
    expect(JSON.stringify(page)).not.toContain(VIEWER_ID);
  });
});

describe('submitRatings (FR-RD-12.1 to 12.3)', () => {
  const clientQuery = vi.fn();
  const client = { query: clientQuery } as unknown as PoolClient;
  const ratings: RatingEntry[] = [
    { occupantId: OWNER_SEAT, score: 4, comment: null },
    { occupantId: OTHER_SEAT, score: 2, comment: 'Arrived 20 minutes late.' },
  ];

  let rater: object | null;
  let seats: object[];
  let existing: object[];
  let inserted: object[];

  beforeEach(() => {
    clientQuery.mockReset();
    rater = { seat_id: MY_SEAT, state: 'completed', completed_at: completedAt };
    seats = [
      { occupant_id: OWNER_SEAT, user_id: OWNER_ID },
      { occupant_id: OTHER_SEAT, user_id: OTHER_ID },
    ];
    existing = [];
    inserted = [{ ratee_id: OWNER_ID }, { ratee_id: OTHER_ID }];
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('FOR NO KEY UPDATE OF me'))
        return Promise.resolve({ rows: rater ? [rater] : [] });
      if (sql.includes('id = ANY($2::uuid[])')) return Promise.resolve({ rows: seats });
      if (sql.includes('SELECT 1 FROM ride_ratings')) return Promise.resolve({ rows: existing });
      if (sql.includes('INSERT INTO ride_ratings')) return Promise.resolve({ rows: inserted });
      return Promise.reject(new Error(`unexpected query: ${sql}`));
    });
  });

  const run = (entries = ratings, now = during) =>
    submitRatings(client, RIDE_ID, VIEWER_ID, entries, now);
  const insertCall = () =>
    clientQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO ride_ratings'));

  it('stores every rating in one statement, by account behind each seat', async () => {
    await expect(run()).resolves.toEqual({ kind: 'rated', count: 2 });
    expect(clientQuery.mock.calls[0][1]).toEqual([RIDE_ID, VIEWER_ID]);
    expect(insertCall()?.[1]).toEqual([
      RIDE_ID,
      VIEWER_ID,
      [OWNER_ID, OTHER_ID],
      [4, 2],
      [null, 'Arrived 20 minutes late.'],
    ]);
    expect(insertCall()?.[0]).toContain('ON CONFLICT ON CONSTRAINT ride_ratings_once DO NOTHING');
  });

  it('finds nothing for someone without a seat on the ride', async () => {
    rater = null;
    await expect(run()).resolves.toEqual({ kind: 'not_found' });
    expect(insertCall()).toBeUndefined();
  });

  it.each([
    ['not completed', { state: 'scheduled', completed_at: null }, during, 'not_completed'],
    ['cancelled', { state: 'cancelled', completed_at: null }, during, 'cancelled'],
    ['US-RD-28 AC1: past the 72 hours', {}, after, 'closed'],
  ])('refuses a ride that is %s', async (_case, change, now, window) => {
    rater = { seat_id: MY_SEAT, state: 'completed', completed_at: completedAt, ...change };
    await expect(run(ratings, now)).resolves.toEqual({ kind: 'window', window });
    expect(insertCall()).toBeUndefined();
  });

  it('refuses rating yourself', async () => {
    await expect(run([{ occupantId: MY_SEAT, score: 5, comment: null }])).resolves.toEqual({
      kind: 'self',
    });
    expect(insertCall()).toBeUndefined();
  });

  it('refuses a seat that is not on this ride', async () => {
    seats = [{ occupant_id: OWNER_SEAT, user_id: OWNER_ID }];
    await expect(run()).resolves.toEqual({ kind: 'not_on_ride' });
    expect(insertCall()).toBeUndefined();
  });

  it('US-RD-28 AC2: refuses the whole request when anyone in it is already rated', async () => {
    existing = [{ '?column?': 1 }];
    await expect(run()).resolves.toEqual({ kind: 'already_rated' });
    const check = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT 1 FROM ride_ratings'),
    );
    expect(check?.[1]).toEqual([RIDE_ID, VIEWER_ID, [OWNER_ID, OTHER_ID]]);
    expect(insertCall()).toBeUndefined();
  });

  it('reports a rating that another request stored first, so the caller rolls back', async () => {
    inserted = [{ ratee_id: OWNER_ID }];
    await expect(run()).resolves.toEqual({ kind: 'already_rated' });
  });
});
