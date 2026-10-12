// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { getComplaintFormPage, getMyComplaints } from './complaint-queries';

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const VIEWER = '6f1c2a5e-2222-4000-8000-000000000001';
const MESSAGE = 'eeeeeeee-4444-4000-8000-000000000001';
const now = new Date('2026-10-12T12:00:00+05:30');
const completed = new Date('2026-10-10T08:00:00+05:30');

const rideRow = {
  id: RIDE,
  direction: 'to_hub',
  state: 'completed',
  departure_start: new Date('2026-10-10T06:30:00+05:30'),
  departure_end: new Date('2026-10-10T07:30:00+05:30'),
  completed_at: completed,
  hub_name: 'Kanpur Central',
};

beforeEach(() => {
  query.mockReset();
});

function answer(ride: unknown[], people: unknown[], message: unknown[] = []) {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM rides r')) return { rows: ride };
    if (sql.includes('FROM ride_chat_messages')) return { rows: message };
    return { rows: people };
  });
}

describe('getComplaintFormPage (FR-RD-13.1, 09.6)', () => {
  it('gives the ride, its window and everyone else on it with what the viewer filed', async () => {
    answer(
      [rideRow],
      [
        {
          occupant_id: 's1',
          name: 'Rohan Verma',
          is_owner: true,
          campus_place: 'Hall 6',
          filed_reference: 'CMP-OLD00001',
        },
        {
          occupant_id: 's2',
          name: 'Dev Patel',
          is_owner: false,
          campus_place: 'Hall 1',
          filed_reference: null,
        },
      ],
    );
    const page = await getComplaintFormPage(RIDE, VIEWER, null, now);
    expect(page).toMatchObject({
      rideId: RIDE,
      title: 'To Kanpur Central',
      window: 'open',
      closesAt: '2026-10-17T02:30:00.000Z',
      message: null,
    });
    expect(page?.people).toEqual([
      {
        occupantId: 's1',
        name: 'Rohan Verma',
        isOwner: true,
        campusPlace: 'Hall 6',
        filedReference: 'CMP-OLD00001',
      },
      {
        occupantId: 's2',
        name: 'Dev Patel',
        isOwner: false,
        campusPlace: 'Hall 1',
        filedReference: null,
      },
    ]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("includes a reported message from someone else in this ride's chat", async () => {
    answer(
      [rideRow],
      [],
      [
        {
          id: MESSAGE,
          body: 'Hurry up.',
          created_at: new Date('2026-10-09T10:00:00Z'),
          sender_occupant_id: 's2',
        },
      ],
    );
    const page = await getComplaintFormPage(RIDE, VIEWER, MESSAGE, now);
    expect(page?.message).toEqual({
      id: MESSAGE,
      body: 'Hurry up.',
      sentAt: '2026-10-09T10:00:00.000Z',
      senderOccupantId: 's2',
    });
    const messageCall = query.mock.calls.find(([sql]) =>
      String(sql).includes('ride_chat_messages'),
    );
    expect(messageCall?.[1]).toEqual([MESSAGE, RIDE, VIEWER]);
  });

  it('is null for someone not on the ride, and never queries for IDs that are not UUIDs', async () => {
    answer([], []);
    await expect(getComplaintFormPage(RIDE, VIEWER, null, now)).resolves.toBeNull();
    query.mockReset();
    await expect(getComplaintFormPage('nope', VIEWER, null, now)).resolves.toBeNull();
    await expect(getComplaintFormPage(RIDE, 'dev-student', null, now)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('ignores a message ID that is not a UUID, and has no closing time before completion', async () => {
    answer([{ ...rideRow, state: 'scheduled', completed_at: null }], []);
    const page = await getComplaintFormPage(RIDE, VIEWER, 'not-an-id', now);
    expect(page).toMatchObject({ window: 'not_completed', closesAt: null, message: null });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('ride_chat_messages'))).toBe(
      false,
    );
  });
});

describe('getMyComplaints (FR-RD-13.5)', () => {
  it('lists the complaints filed, showing whether action was taken only once resolved', async () => {
    query.mockResolvedValue({
      rows: [
        {
          reference: 'CMP-1A2B3C4D',
          ride_id: RIDE,
          direction: 'to_hub',
          hub_name: 'Kanpur Central',
          departure_start: new Date('2026-10-10T01:00:00Z'),
          about: 'Rohan Verma',
          category: 'tardiness',
          status: 'resolved',
          action_taken: false,
          created_at: new Date('2026-10-11T04:00:00Z'),
        },
        {
          reference: 'CMP-2B3C4D5E',
          ride_id: RIDE,
          direction: 'from_hub',
          hub_name: 'Kanpur Central',
          departure_start: new Date('2026-10-10T01:00:00Z'),
          about: 'Dev Patel',
          category: 'payment',
          status: 'under_review',
          action_taken: true,
          created_at: new Date('2026-10-11T05:00:00Z'),
        },
      ],
    });
    const complaints = await getMyComplaints(VIEWER);
    expect(complaints[0]).toMatchObject({
      reference: 'CMP-1A2B3C4D',
      status: 'resolved',
      actionTaken: false,
    });
    expect(complaints[1]).toMatchObject({ status: 'under_review', actionTaken: null });
    expect(query.mock.calls[0][1]).toEqual([VIEWER]);
  });

  it('is empty for an ID that is not a UUID, without a query', async () => {
    await expect(getMyComplaints('dev-student')).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
