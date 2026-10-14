import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const query = vi.hoisted(() => vi.fn());
const connect = vi.hoisted(() => vi.fn());
vi.mock('../db', () => ({ pool: { query, connect } }));

import {
  createPreferenceProposal,
  getPreferenceProposal,
  confirmPreferenceProposal,
  getPreferenceSnapshot,
  PROPOSAL_TTL_MS,
} from './preference-proposals';
import { RIDE_RULES } from '../ride-rules';

const USER_ID = 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa';
const PROPOSAL_ID = 'cccccccc-cccc-4000-8000-cccccccccccc';
const NOW = new Date('2026-10-14T12:00:00.000Z');

beforeEach(() => {
  query.mockReset();
  connect.mockReset();
});

describe('Preference Proposals (FR-RD-05.3, AI-RD-04, US-RD-14)', () => {
  describe('Constants & Snapshot', () => {
    it('enforces a strict 10-minute TTL constant (600,000 ms)', () => {
      expect(PROPOSAL_TTL_MS).toBe(10 * 60 * 1000);
      expect(PROPOSAL_TTL_MS).toBe(600_000);
    });

    it('fetches preference snapshot with active tags and location mappings', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            pickup_id: 'loc-hall-3',
            pickup_name: 'Hall 3',
            vehicle_id: 'veh-auto',
            vehicle_name: 'Auto',
            max_share: 120,
          },
        ],
      });
      query.mockResolvedValueOnce({
        rows: [
          { id: 'tag-1', name: 'Music', is_visible: true },
          { id: 'tag-2', name: 'Sports', is_visible: false },
        ],
      });

      const snapshot = await getPreferenceSnapshot(USER_ID);
      expect(snapshot).toEqual({
        defaultPickupPoint: { id: 'loc-hall-3', name: 'Hall 3' },
        preferredVehicleType: { id: 'veh-auto', name: 'Auto' },
        maxAcceptableFareShare: 120,
        interestTags: [
          { id: 'tag-1', name: 'Music', visible: true },
          { id: 'tag-2', name: 'Sports', visible: false },
        ],
      });
    });

    it('handles empty preference snapshot gracefully', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      const snapshot = await getPreferenceSnapshot(USER_ID);
      expect(snapshot).toEqual({
        defaultPickupPoint: null,
        preferredVehicleType: null,
        maxAcceptableFareShare: null,
        interestTags: [],
      });
    });
  });

  describe('createPreferenceProposal', () => {
    it('rejects invalid user IDs', async () => {
      await expect(createPreferenceProposal('not-a-uuid', {})).rejects.toThrow('Invalid user ID.');
    });

    it('validates campus pickup location existence and type', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // location not found or not active campus
      await expect(
        createPreferenceProposal(USER_ID, { defaultPickupPointId: 'invalid-loc' }),
      ).rejects.toThrow('Unknown or inactive campus pickup location.');
    });

    it('validates preferred vehicle type existence', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // vehicle type not found
      await expect(
        createPreferenceProposal(USER_ID, { preferredVehicleTypeId: 'invalid-veh' }),
      ).rejects.toThrow('Unknown or inactive vehicle type.');
    });

    it('validates max acceptable fare share boundaries', async () => {
      await expect(
        createPreferenceProposal(USER_ID, { maxAcceptableFareShare: 0 }),
      ).rejects.toThrow(`Max fare share must be between ₹1 and ₹${RIDE_RULES.maxFare}.`);

      await expect(
        createPreferenceProposal(USER_ID, { maxAcceptableFareShare: 50_001 }),
      ).rejects.toThrow(`Max fare share must be between ₹1 and ₹${RIDE_RULES.maxFare}.`);

      await expect(
        createPreferenceProposal(USER_ID, { maxAcceptableFareShare: 50.5 }),
      ).rejects.toThrow(`Max fare share must be between ₹1 and ₹${RIDE_RULES.maxFare}.`);
    });

    it('validates interest tags limit and active status', async () => {
      const elevenTags = Array.from({ length: 11 }, (_, i) => ({
        id: `tag-${i}`,
        visible: true,
      }));
      await expect(createPreferenceProposal(USER_ID, { interestTags: elevenTags })).rejects.toThrow(
        'At most 10 interest tags allowed.',
      );

      query.mockResolvedValueOnce({ rows: [{ id: 'tag-1' }] }); // only 1 returned out of 2
      await expect(
        createPreferenceProposal(USER_ID, {
          interestTags: [
            { id: 'tag-1', visible: true },
            { id: 'tag-2', visible: true },
          ],
        }),
      ).rejects.toThrow('One or more interest tags are invalid or inactive.');
    });

    it('creates proposal with accurate before/after diff and sets exactly 10 min TTL', async () => {
      // 1. Validation checks
      query.mockResolvedValueOnce({ rows: [{ id: 'loc-hall-12' }] }); // location check
      query.mockResolvedValueOnce({ rows: [{ id: 'veh-cab' }] }); // vehicle check

      // 2. getPreferenceSnapshot (before)
      query.mockResolvedValueOnce({
        rows: [
          {
            pickup_id: 'loc-hall-1',
            pickup_name: 'Hall 1',
            vehicle_id: 'veh-auto',
            vehicle_name: 'Auto',
            max_share: 150,
          },
        ],
      });
      query.mockResolvedValueOnce({ rows: [] });

      // 3. Lookups for after values
      query.mockResolvedValueOnce({ rows: [{ id: 'loc-hall-12', name: 'Hall 12' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 'veh-cab', name: 'Cab' }] });

      // 4. DB insert
      query.mockResolvedValueOnce({ rows: [] });

      const proposal = await createPreferenceProposal(
        USER_ID,
        {
          defaultPickupPointId: 'loc-hall-12',
          preferredVehicleTypeId: 'veh-cab',
          maxAcceptableFareShare: 200,
        },
        NOW,
      );

      expect(proposal.id).toBeDefined();
      expect(proposal.userId).toBe(USER_ID);
      expect(proposal.status).toBe('pending');
      expect(proposal.before.defaultPickupPoint?.name).toBe('Hall 1');
      expect(proposal.before.preferredVehicleType?.name).toBe('Auto');
      expect(proposal.before.maxAcceptableFareShare).toBe(150);

      expect(proposal.after.defaultPickupPoint?.name).toBe('Hall 12');
      expect(proposal.after.preferredVehicleType?.name).toBe('Cab');
      expect(proposal.after.maxAcceptableFareShare).toBe(200);

      const expectedExpiry = new Date(NOW.getTime() + 10 * 60 * 1000).toISOString();
      expect(proposal.expiresAt).toBe(expectedExpiry);
      expect(proposal.createdAt).toBe(NOW.toISOString());
    });
  });

  describe('getPreferenceProposal', () => {
    it('returns null for non-existent proposal or invalid ID', async () => {
      const res1 = await getPreferenceProposal('invalid', USER_ID);
      expect(res1).toBeNull();

      query.mockResolvedValueOnce({ rows: [] });
      const res2 = await getPreferenceProposal(PROPOSAL_ID, USER_ID);
      expect(res2).toBeNull();
    });

    it('returns active pending proposal when within 10 minutes', async () => {
      const expiresAt = new Date(NOW.getTime() + 5 * 60 * 1000); // 5 mins in future
      query.mockResolvedValueOnce({
        rows: [
          {
            id: PROPOSAL_ID,
            user_id: USER_ID,
            before_snapshot: {
              defaultPickupPoint: null,
              preferredVehicleType: null,
              maxAcceptableFareShare: null,
              interestTags: [],
            },
            proposed_changes: { maxAcceptableFareShare: 180 },
            status: 'pending',
            expires_at: expiresAt,
            created_at: NOW,
          },
        ],
      });

      const proposal = await getPreferenceProposal(PROPOSAL_ID, USER_ID, NOW);
      expect(proposal).not.toBeNull();
      expect(proposal?.status).toBe('pending');
      expect(proposal?.after.maxAcceptableFareShare).toBe(180);
    });

    it('marks proposal as expired if accessed after 10 minutes', async () => {
      const expiresAt = new Date(NOW.getTime() - 1000); // 1 second in past
      query.mockResolvedValueOnce({
        rows: [
          {
            id: PROPOSAL_ID,
            user_id: USER_ID,
            before_snapshot: {
              defaultPickupPoint: null,
              preferredVehicleType: null,
              maxAcceptableFareShare: null,
              interestTags: [],
            },
            proposed_changes: { maxAcceptableFareShare: 180 },
            status: 'pending',
            expires_at: expiresAt,
            created_at: NOW,
          },
        ],
      });
      query.mockResolvedValueOnce({ rows: [] }); // update status to expired

      const proposal = await getPreferenceProposal(PROPOSAL_ID, USER_ID, NOW);
      expect(proposal).not.toBeNull();
      expect(proposal?.status).toBe('expired');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE chatbot_preference_proposals SET status = 'expired'"),
        [PROPOSAL_ID],
      );
    });
  });

  describe('confirmPreferenceProposal (Explicit Rider Confirmation & Expiration)', () => {
    it('rejects confirmation with invalid ID or rider', async () => {
      const res = await confirmPreferenceProposal('bad-id', USER_ID);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid proposal or user ID.');
    });

    it('rejects confirmation if proposal not found', async () => {
      const clientQuery = vi.fn();
      const release = vi.fn();
      connect.mockResolvedValueOnce({ query: clientQuery, release });

      clientQuery.mockResolvedValueOnce({}); // BEGIN
      clientQuery.mockResolvedValueOnce({ rows: [] }); // SELECT FOR UPDATE -> not found
      clientQuery.mockResolvedValueOnce({}); // ROLLBACK

      const res = await confirmPreferenceProposal(PROPOSAL_ID, USER_ID, NOW);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Proposal not found.');
      expect(release).toHaveBeenCalled();
    });

    it('rejects confirmation if proposal is already confirmed or cancelled', async () => {
      const clientQuery = vi.fn();
      const release = vi.fn();
      connect.mockResolvedValueOnce({ query: clientQuery, release });

      clientQuery.mockResolvedValueOnce({}); // BEGIN
      clientQuery.mockResolvedValueOnce({
        rows: [
          {
            status: 'confirmed',
            expires_at: new Date(NOW.getTime() + 5000),
            proposed_changes: {},
          },
        ],
      });
      clientQuery.mockResolvedValueOnce({}); // ROLLBACK

      const res = await confirmPreferenceProposal(PROPOSAL_ID, USER_ID, NOW);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Proposal is already confirmed.');
    });

    it('enforces 10-minute expiry: rejects confirmation if 10 minutes have elapsed (FR-RD-05.3, AI-RD-04)', async () => {
      const clientQuery = vi.fn();
      const release = vi.fn();
      connect.mockResolvedValueOnce({ query: clientQuery, release });

      const expiresAt = new Date(NOW.getTime() + PROPOSAL_TTL_MS);

      clientQuery.mockResolvedValueOnce({}); // BEGIN
      clientQuery.mockResolvedValueOnce({
        rows: [
          {
            status: 'pending',
            expires_at: expiresAt,
            proposed_changes: { maxAcceptableFareShare: 200 },
          },
        ],
      });
      clientQuery.mockResolvedValueOnce({}); // UPDATE status = 'expired'
      clientQuery.mockResolvedValueOnce({}); // COMMIT

      // Attempt confirmation at 10 minutes + 1 millisecond
      const expiredTime = new Date(NOW.getTime() + PROPOSAL_TTL_MS + 1);
      const res = await confirmPreferenceProposal(PROPOSAL_ID, USER_ID, expiredTime);

      expect(res.success).toBe(false);
      expect(res.error).toContain(
        'This proposal has expired (unconfirmed proposals lapse after 10 minutes).',
      );
      expect(clientQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE chatbot_preference_proposals SET status = 'expired'"),
        [PROPOSAL_ID],
      );
    });

    it('applies preference changes atomically on confirmation within 10 minutes', async () => {
      const clientQuery = vi.fn();
      const release = vi.fn();
      connect.mockResolvedValueOnce({ query: clientQuery, release });

      const expiresAt = new Date(NOW.getTime() + PROPOSAL_TTL_MS);

      clientQuery.mockResolvedValueOnce({}); // BEGIN
      clientQuery.mockResolvedValueOnce({
        rows: [
          {
            status: 'pending',
            expires_at: expiresAt,
            proposed_changes: {
              defaultPickupPointId: 'loc-hall-7',
              preferredVehicleTypeId: 'veh-auto',
              maxAcceptableFareShare: 180,
              interestTags: [{ id: 'tag-coding', visible: true }],
            },
          },
        ],
      });
      clientQuery.mockResolvedValueOnce({}); // UPDATE user_profiles
      clientQuery.mockResolvedValueOnce({}); // DELETE FROM user_profile_tags
      clientQuery.mockResolvedValueOnce({}); // INSERT INTO user_profile_tags
      clientQuery.mockResolvedValueOnce({}); // UPDATE chatbot_preference_proposals status = confirmed
      clientQuery.mockResolvedValueOnce({}); // COMMIT

      // Confirm at 4 minutes in
      const confirmTime = new Date(NOW.getTime() + 4 * 60 * 1000);
      const res = await confirmPreferenceProposal(PROPOSAL_ID, USER_ID, confirmTime);

      expect(res.success).toBe(true);
      expect(clientQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_profiles SET'),
        expect.arrayContaining([USER_ID, 'loc-hall-7', 'veh-auto', 180]),
      );
      expect(clientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_profile_tags'),
        [USER_ID, 'tag-coding', true],
      );
      expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'confirmed'"), [
        PROPOSAL_ID,
        confirmTime,
      ]);
      expect(release).toHaveBeenCalled();
    });
  });
});
