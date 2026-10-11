// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ query: vi.fn(), getActiveSuspension: vi.fn() }));
vi.mock('./db', () => ({ pool: { query: h.query } }));
vi.mock('./suspensions', () => ({ getActiveSuspension: h.getActiveSuspension }));

import { getComplaintDetail, listComplaints, parseQueueFilters } from './admin-complaint-queries';
import { getAdminRide, getRiderRecord, searchRiders } from './admin-rider-queries';

const ID = 'c0c0c0c0-1111-4000-8000-000000000001';
const USER = '6f1c2a5e-2222-4000-8000-000000000002';
const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const at = new Date('2026-10-11T04:00:00Z');

beforeEach(() => {
  h.query.mockReset();
  h.getActiveSuspension.mockReset();
  h.getActiveSuspension.mockResolvedValue(null);
});

describe('the complaint queue (CS455-53)', () => {
  it('reads its filters from the URL, falling back to the defaults', () => {
    expect(parseQueueFilters({})).toEqual({ status: 'open', category: 'all', source: 'all' });
    expect(parseQueueFilters({ status: 'all', category: 'no_show', source: 'form' })).toEqual({
      status: 'all',
      category: 'no_show',
      source: 'form',
    });
    expect(parseQueueFilters({ status: ['resolved', 'all'], category: 'sos' })).toEqual({
      status: 'open',
      category: 'all',
      source: 'all',
    });
  });

  it('lists complaints with the filters as parameters, Safety first', async () => {
    h.query.mockResolvedValue({
      rows: [
        {
          id: ID,
          reference: 'CMP-1A2B3C4D',
          category: 'safety',
          source: 'form',
          status: 'submitted',
          created_at: at,
          about: 'Dev Patel',
          direction: 'to_hub',
          hub_name: 'Kanpur Central',
        },
      ],
    });
    const complaints = await listComplaints({
      status: 'open',
      category: 'all',
      source: 'chat_report',
    });
    expect(complaints[0]).toMatchObject({
      id: ID,
      about: 'Dev Patel',
      createdAt: at.toISOString(),
    });
    expect(complaints[0].rideTitle).toContain('Kanpur Central');
    expect(h.query.mock.calls[0][1]).toEqual(['open', 'all', 'chat_report']);
    expect(String(h.query.mock.calls[0][0])).toContain(
      "(c.category = 'safety' AND c.status <> 'resolved') DESC",
    );
  });
});

describe('getComplaintDetail (OA-FR-18, 20)', () => {
  const row = {
    id: ID,
    reference: 'CMP-1A2B3C4D',
    legacy_reference: 'chat-fa0a0f50',
    category: 'harassment',
    source: 'chat_report',
    status: 'resolved',
    action_taken: false,
    resolution_note: 'Talked to both.',
    version: 3,
    description: 'Rude in the chat.',
    created_at: at,
    resolved_at: at,
    resolved_by_name: 'Ops Admin',
    complainant_id: 'u1',
    complainant_name: 'Aditi',
    complainant_email: 'aditi@iitk.ac.in',
    accused_id: USER,
    accused_name: 'Rohan',
    accused_email: 'rohan@iitk.ac.in',
    ride_id: RIDE,
    direction: 'from_hub',
    hub_name: 'Kanpur Central',
    departure_start: at,
    departure_end: at,
    ride_state: 'scheduled',
  };

  it('gives the complaint with its messages and the other complaints about the same person', async () => {
    h.query.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE c.id = $1')) return { rows: [row] };
      if (sql.includes('complaint_chat_messages')) {
        return { rows: [{ id: 'm1', body: 'Rude words.', created_at: at, sender_name: 'Rohan' }] };
      }
      return {
        rows: [
          {
            id: 'c0',
            reference: 'CMP-0A0B0C0D',
            category: 'other',
            status: 'submitted',
            created_at: at,
          },
        ],
      };
    });
    const detail = await getComplaintDetail(ID);
    expect(detail).toMatchObject({
      reference: 'CMP-1A2B3C4D',
      legacyReference: 'chat-fa0a0f50',
      actionTaken: false,
      note: 'Talked to both.',
      resolvedBy: 'Ops Admin',
      complainant: { id: 'u1', name: 'Aditi', email: 'aditi@iitk.ac.in' },
      accused: { id: USER, name: 'Rohan' },
      ride: { id: RIDE, state: 'scheduled' },
      messages: [{ id: 'm1', body: 'Rude words.', senderName: 'Rohan' }],
      earlierAboutAccused: [{ reference: 'CMP-0A0B0C0D' }],
    });
    const earlier = h.query.mock.calls.find(([sql]) =>
      String(sql).includes('accused_id = $1 AND id <> $2'),
    );
    expect(earlier?.[1]).toEqual([USER, ID]);
  });

  it('is null for an unknown complaint or an ID that is not a UUID', async () => {
    h.query.mockResolvedValue({ rows: [] });
    await expect(getComplaintDetail(ID)).resolves.toBeNull();
    h.query.mockReset();
    await expect(getComplaintDetail('x')).resolves.toBeNull();
    expect(h.query).not.toHaveBeenCalled();
  });
});

describe('searchRiders (OA-FR-42)', () => {
  it('searches name, email and roll number, escaping LIKE characters', async () => {
    h.query.mockResolvedValue({
      rows: [
        {
          id: USER,
          name: 'Rohan',
          email: 'rohan@iitk.ac.in',
          roll_number: '220001',
          role: 'student',
          suspended: true,
        },
      ],
    });
    await expect(searchRiders('  50%_off ')).resolves.toEqual([
      {
        id: USER,
        name: 'Rohan',
        email: 'rohan@iitk.ac.in',
        rollNumber: '220001',
        isAdmin: false,
        suspended: true,
      },
    ]);
    expect(h.query.mock.calls[0][1]).toEqual(['%50\\%\\_off%']);
  });

  it('needs at least 2 characters', async () => {
    await expect(searchRiders(' a ')).resolves.toEqual([]);
    expect(h.query).not.toHaveBeenCalled();
  });
});

describe('getRiderRecord (OA-FR-42, SYS-NFR-07)', () => {
  it('gives identity, status and the whole history', async () => {
    h.getActiveSuspension.mockResolvedValue({
      id: 's1',
      reasonCategory: 'safety',
      startsAt: 'a',
      endsAt: null,
      isIndefinite: true,
    });
    h.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users u LEFT JOIN user_profiles')) {
        return {
          rows: [
            {
              id: USER,
              full_name: 'Rohan Verma',
              display_name: null,
              email: 'rohan@iitk.ac.in',
              roll_number: '220001',
              mobile_number: '9876543210',
              role: 'student',
              email_verified_at: at,
              created_at: at,
            },
          ],
        };
      }
      if (sql.includes('FROM riders m')) {
        return {
          rows: [
            {
              id: RIDE,
              direction: 'to_hub',
              hub_name: 'Kanpur Central',
              departure_start: at,
              state: 'completed',
              as_owner: true,
            },
          ],
        };
      }
      if (sql.includes('complainant_id = $1')) return { rows: [] };
      if (sql.includes('accused_id = $1')) {
        return {
          rows: [
            {
              id: ID,
              reference: 'CMP-1A2B3C4D',
              category: 'safety',
              status: 'submitted',
              created_at: at,
            },
          ],
        };
      }
      if (sql.includes('FROM rider_warnings')) {
        return {
          rows: [
            {
              id: 'w1',
              reason: 'Late',
              issued_at: at,
              issued_by: 'Ops Admin',
              complaint_reference: null,
            },
          ],
        };
      }
      return {
        rows: [
          {
            id: 's1',
            reason_category: 'safety',
            reason: 'Unsafe',
            starts_at: at,
            ends_at: null,
            is_indefinite: true,
            issued_by: 'Ops Admin',
            lifted_at: null,
            lifted_by: null,
            lift_reason: null,
          },
        ],
      };
    });
    const record = await getRiderRecord(USER);
    expect(record).toMatchObject({
      fullName: 'Rohan Verma',
      mobile: '9876543210',
      isAdmin: false,
      verified: true,
      suspension: { id: 's1', isIndefinite: true },
      rides: [{ id: RIDE, asOwner: true, state: 'completed' }],
      complaintsFiled: [],
      complaintsReceived: [{ reference: 'CMP-1A2B3C4D' }],
      warnings: [{ reason: 'Late', issuedBy: 'Ops Admin' }],
      suspensions: [{ reason: 'Unsafe', endsAt: null, liftedAt: null }],
    });
  });

  it('is null for an unknown account or an ID that is not a UUID', async () => {
    h.query.mockResolvedValue({ rows: [] });
    await expect(getRiderRecord(USER)).resolves.toBeNull();
    await expect(getRiderRecord('dev-admin')).resolves.toBeNull();
  });
});

describe('getAdminRide (SYS-FR-17)', () => {
  it('gives the ride with everyone on it and its complaints', async () => {
    h.query.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN vehicle_types')) {
        return {
          rows: [
            {
              id: RIDE,
              direction: 'to_hub',
              hub_name: 'Kanpur Central',
              state: 'completed',
              departure_start: at,
              departure_end: at,
              vehicle_name: 'Auto',
              capacity_snapshot: 3,
              expected_total_fare: 400,
              created_at: at,
              completed_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM riders m')) {
        return {
          rows: [
            { user_id: USER, name: 'Rohan', is_owner: true, campus_place: 'Hall 6', joined_at: at },
          ],
        };
      }
      return {
        rows: [{ id: ID, reference: 'CMP-1A2B3C4D', category: 'safety', status: 'submitted' }],
      };
    });
    await expect(getAdminRide(RIDE)).resolves.toMatchObject({
      vehicleName: 'Auto',
      capacity: 3,
      totalFare: 400,
      completedAt: null,
      occupants: [{ userId: USER, isOwner: true, campusPlace: 'Hall 6' }],
      complaints: [{ reference: 'CMP-1A2B3C4D' }],
    });
  });

  it('is null for an unknown ride or an ID that is not a UUID', async () => {
    h.query.mockResolvedValue({ rows: [] });
    await expect(getAdminRide(RIDE)).resolves.toBeNull();
    await expect(getAdminRide('x')).resolves.toBeNull();
  });
});
