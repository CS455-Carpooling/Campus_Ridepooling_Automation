// @vitest-environment node
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { ComplaintRequest } from './complaint-rules';
import { changeComplaintStatus, fileComplaint } from './complaints';

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const ME = '6f1c2a5e-2222-4000-8000-000000000001';
const OTHER = '6f1c2a5e-2222-4000-8000-000000000002';
const SEAT = 'a1a1a1a1-3333-4000-8000-000000000002';
const MESSAGE = 'eeeeeeee-4444-4000-8000-000000000001';
const ADMIN = '6f1c2a5e-2222-4000-8000-0000000000aa';
const now = new Date('2026-10-12T12:00:00+05:30');

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

type Answers = {
  ride?: unknown[];
  accused?: unknown[];
  message?: unknown[];
  existing?: unknown[];
  today?: number;
};

/** Answers fileComplaint's queries in order: lock, ride, accused, message, existing, count. */
function filingClient(answers: Answers) {
  const query = vi.fn<Query>(async (sql) => {
    if (sql.includes('FOR NO KEY UPDATE')) return { rows: [] };
    if (sql.includes('FROM rides r'))
      return {
        rows: answers.ride ?? [
          { state: 'completed', completed_at: new Date('2026-10-10T08:00:00+05:30') },
        ],
      };
    if (sql.includes('FROM riders WHERE id'))
      return { rows: answers.accused ?? [{ user_id: OTHER }] };
    if (sql.includes('FROM ride_chat_messages'))
      return { rows: answers.message ?? [{ '?column?': 1 }] };
    if (sql.includes('SELECT reference FROM complaints')) return { rows: answers.existing ?? [] };
    if (sql.includes('count(*)')) return { rows: [{ count: answers.today ?? 0 }] };
    if (sql.includes('INSERT INTO complaints'))
      return { rows: [{ id: 'c-1', reference: 'CMP-1A2B3C4D' }] };
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, query };
}

const request: ComplaintRequest = {
  occupantId: SEAT,
  category: 'tardiness',
  description: 'Arrived 25 minutes late to the pickup point.',
  messageId: null,
};

const sql = (query: { mock: { calls: Array<[string, unknown[]?]> } }) =>
  query.mock.calls.map(([text]) => String(text));

describe('fileComplaint (FR-RD-13.1 to 13.4)', () => {
  it('files a complaint about someone on the ride, within 7 days of completion', async () => {
    const { client, query } = filingClient({});
    await expect(fileComplaint(client, RIDE, ME, request, now)).resolves.toEqual({
      kind: 'filed',
      id: 'c-1',
      reference: 'CMP-1A2B3C4D',
    });
    const insert = query.mock.calls.find(([text]) =>
      String(text).includes('INSERT INTO complaints'),
    );
    expect(insert?.[1]).toEqual([RIDE, ME, OTHER, 'tardiness', request.description]);
    expect(sql(query)[0]).toContain('FOR NO KEY UPDATE');
    expect(sql(query).some((text) => text.includes('complaint_chat_messages'))).toBe(false);
  });

  it('is "not found" to someone not on the ride (FR-RD-13.3)', async () => {
    const { client } = filingClient({ ride: [] });
    await expect(fileComplaint(client, RIDE, ME, request, now)).resolves.toEqual({
      kind: 'not_found',
    });
  });

  it('refuses a seat that is not on this ride, and a complaint about yourself', async () => {
    await expect(
      fileComplaint(filingClient({ accused: [] }).client, RIDE, ME, request, now),
    ).resolves.toEqual({
      kind: 'not_on_ride',
    });
    await expect(
      fileComplaint(filingClient({ accused: [{ user_id: ME }] }).client, RIDE, ME, request, now),
    ).resolves.toEqual({ kind: 'self' });
  });

  it.each([
    ['not completed yet', { state: 'scheduled', completed_at: null }, 'not_completed'],
    ['cancelled', { state: 'cancelled', completed_at: null }, 'cancelled'],
    [
      'completed more than 7 days ago',
      { state: 'completed', completed_at: new Date('2026-10-01T08:00:00+05:30') },
      'closed',
    ],
  ])('refuses a trip complaint when the ride is %s', async (_, ride, window) => {
    const { client } = filingClient({ ride: [ride] });
    await expect(fileComplaint(client, RIDE, ME, request, now)).resolves.toEqual({
      kind: 'window',
      window,
    });
  });

  it('accepts a reported chat message before completion, and links it (FR-RD-09.6)', async () => {
    const { client, query } = filingClient({ ride: [{ state: 'scheduled', completed_at: null }] });
    const result = await fileComplaint(
      client,
      RIDE,
      ME,
      { ...request, category: 'harassment', messageId: MESSAGE },
      now,
    );
    expect(result).toEqual({ kind: 'filed', id: 'c-1', reference: 'CMP-1A2B3C4D' });
    const message = query.mock.calls.find(([text]) =>
      String(text).includes('FROM ride_chat_messages'),
    );
    expect(message?.[1]).toEqual([MESSAGE, RIDE, OTHER]);
    const link = query.mock.calls.find(([text]) =>
      String(text).includes('INSERT INTO complaint_chat_messages'),
    );
    expect(link?.[1]).toEqual(['c-1', MESSAGE]);
  });

  it('keeps trip complaints between people who stayed on the ride (FR-RD-13.1)', async () => {
    const left = new Date('2026-10-09T18:00:00+05:30');
    const completed = new Date('2026-10-10T08:00:00+05:30');
    const { client: leaver, query } = filingClient({
      ride: [{ state: 'completed', completed_at: completed, no_show_at: null, left_at: left }],
    });
    await expect(fileComplaint(leaver, RIDE, ME, request, now)).resolves.toEqual({
      kind: 'not_found',
    });
    expect(sql(query).find((text) => text.includes('FROM rides r'))).toContain('me.left_at');
    expect(sql(query).some((text) => text.includes('INSERT INTO complaints'))).toBe(false);

    const { client: aboutLeaver } = filingClient({ accused: [{ user_id: OTHER, left_at: left }] });
    await expect(fileComplaint(aboutLeaver, RIDE, ME, request, now)).resolves.toEqual({
      kind: 'not_on_ride',
    });
  });

  it('still lets a late leaver, who owes their locked share, complain and be complained about', async () => {
    const left = new Date('2026-10-10T07:45:00+05:30');
    const completed = new Date('2026-10-10T08:00:00+05:30');
    const { client: aboutLateLeaver, query } = filingClient({
      accused: [{ user_id: OTHER, left_at: left, locked_share: 150 }],
    });
    await expect(
      fileComplaint(aboutLateLeaver, RIDE, ME, { ...request, category: 'payment' }, now),
    ).resolves.toEqual({ kind: 'filed', id: 'c-1', reference: 'CMP-1A2B3C4D' });
    expect(sql(query).find((text) => text.includes('FROM riders WHERE id'))).toContain(
      'locked_share',
    );

    const { client: byLateLeaver } = filingClient({
      ride: [
        {
          state: 'completed',
          completed_at: completed,
          no_show_at: null,
          left_at: left,
          locked_share: 150,
        },
      ],
    });
    await expect(fileComplaint(byLateLeaver, RIDE, ME, request, now)).resolves.toMatchObject({
      kind: 'filed',
    });
  });

  it('still takes a reported message from someone who has since left the ride', async () => {
    const { client } = filingClient({
      ride: [{ state: 'scheduled', completed_at: null, no_show_at: null, left_at: null }],
      accused: [{ user_id: OTHER, left_at: new Date('2026-10-12T10:00:00+05:30') }],
    });
    await expect(
      fileComplaint(
        client,
        RIDE,
        ME,
        { ...request, category: 'harassment', messageId: MESSAGE },
        now,
      ),
    ).resolves.toEqual({ kind: 'filed', id: 'c-1', reference: 'CMP-1A2B3C4D' });
  });

  it("refuses a message that is not this person's message in this ride's chat", async () => {
    const { client } = filingClient({ message: [] });
    await expect(
      fileComplaint(client, RIDE, ME, { ...request, messageId: MESSAGE }, now),
    ).resolves.toEqual({
      kind: 'message_not_found',
    });
  });

  it('accepts one complaint per person, ride and accused, and says which (FR-RD-13.4)', async () => {
    const { client, query } = filingClient({ existing: [{ reference: 'CMP-OLD00001' }] });
    await expect(fileComplaint(client, RIDE, ME, request, now)).resolves.toEqual({
      kind: 'already_filed',
      reference: 'CMP-OLD00001',
    });
    expect(sql(query).some((text) => text.includes('INSERT'))).toBe(false);
  });

  it('accepts at most 5 complaints in 24 hours (P-17)', async () => {
    await expect(
      fileComplaint(filingClient({ today: 5 }).client, RIDE, ME, request, now),
    ).resolves.toEqual({
      kind: 'daily_limit',
    });
    await expect(
      fileComplaint(filingClient({ today: 4 }).client, RIDE, ME, request, now),
    ).resolves.toMatchObject({
      kind: 'filed',
    });
  });
});

const complaintRow = (change: Record<string, unknown> = {}) => ({
  id: 'c-1',
  reference: 'CMP-1A2B3C4D',
  status: 'submitted',
  action_taken: null,
  resolution_note: null,
  version: 1,
  complainant_id: ME,
  ride_id: RIDE,
  ...change,
});

function statusClient(current: unknown[], saved: Record<string, unknown>) {
  const query = vi.fn<Query>(async (text) => {
    if (text.includes('FOR UPDATE')) return { rows: current };
    if (text.includes('UPDATE complaints')) return { rows: [complaintRow(saved)] };
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, query };
}

describe('changeComplaintStatus (OA-FR-18, FR-RD-13.5)', () => {
  it('moves a complaint under review and tells the person who complained', async () => {
    const { client, query } = statusClient([complaintRow()], {
      status: 'under_review',
      version: 2,
    });
    const result = await changeComplaintStatus(
      client,
      'c-1',
      { status: 'under_review', version: 1 },
      ADMIN,
      now,
    );
    expect(result).toMatchObject({
      kind: 'changed',
      before: { status: 'submitted', version: 1 },
      after: { status: 'under_review', version: 2 },
    });
    const update = query.mock.calls.find(([text]) => String(text).includes('UPDATE complaints'));
    expect(update?.[1]).toEqual(['c-1', 'under_review', false, null, null, now, ADMIN]);
    const notice = query.mock.calls.find(([text]) =>
      String(text).includes('INSERT INTO notifications'),
    );
    expect(notice?.[1]).toEqual([
      ME,
      'Complaint CMP-1A2B3C4D: Under review',
      'Your complaint CMP-1A2B3C4D is now under review.',
      RIDE,
    ]);
    expect(sql(query).some((text) => text.includes('ride_chat_complaints'))).toBe(false);
  });

  it('resolves with the outcome, closes its chat reports, and says only whether action was taken', async () => {
    const { client, query } = statusClient([complaintRow({ status: 'under_review', version: 2 })], {
      status: 'resolved',
      action_taken: true,
      resolution_note: 'Warned.',
      version: 3,
    });
    await changeComplaintStatus(
      client,
      'c-1',
      { status: 'resolved', actionTaken: true, note: 'Warned.', version: 2 },
      ADMIN,
      now,
    );
    const chat = query.mock.calls.find(([text]) => String(text).includes('ride_chat_complaints'));
    expect(chat?.[1]).toEqual(['c-1', ME, now]);
    const notice = query.mock.calls.find(([text]) =>
      String(text).includes('INSERT INTO notifications'),
    );
    expect(notice?.[1]?.[2]).toBe('Your complaint CMP-1A2B3C4D is now resolved. Action was taken.');
    expect(JSON.stringify(notice?.[1])).not.toContain('Warned.');
  });

  it('says "no action" when none was taken', async () => {
    const { client, query } = statusClient([complaintRow()], {
      status: 'resolved',
      action_taken: false,
      version: 2,
    });
    await changeComplaintStatus(
      client,
      'c-1',
      { status: 'resolved', actionTaken: false, version: 1 },
      ADMIN,
      now,
    );
    const notice = query.mock.calls.find(([text]) =>
      String(text).includes('INSERT INTO notifications'),
    );
    expect(notice?.[1]?.[2]).toBe(
      'Your complaint CMP-1A2B3C4D is now resolved. No action was taken.',
    );
  });

  it('refuses an unknown complaint, an older version, and a resolved one', async () => {
    await expect(
      changeComplaintStatus(
        statusClient([], {}).client,
        'c-9',
        { status: 'under_review', version: 1 },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({ kind: 'not_found' });
    await expect(
      changeComplaintStatus(
        statusClient([complaintRow({ version: 2 })], {}).client,
        'c-1',
        { status: 'under_review', version: 1 },
        ADMIN,
        now,
      ),
    ).resolves.toMatchObject({ kind: 'version_conflict', current: { version: 2 } });
    const resolved = statusClient([complaintRow({ status: 'resolved', action_taken: false })], {});
    await expect(
      changeComplaintStatus(
        resolved.client,
        'c-1',
        { status: 'under_review', version: 1 },
        ADMIN,
        now,
      ),
    ).resolves.toMatchObject({ kind: 'not_allowed', current: { status: 'resolved' } });
    expect(sql(resolved.query).some((text) => text.includes('UPDATE complaints'))).toBe(false);
  });
});
