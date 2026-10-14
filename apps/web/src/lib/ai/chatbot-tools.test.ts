import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const query = vi.hoisted(() => vi.fn());
const connect = vi.hoisted(() => vi.fn());
vi.mock('../db', () => ({ pool: { query, connect } }));

const searchRidesMock = vi.hoisted(() => vi.fn());
vi.mock('../ride-search', () => ({ searchRides: searchRidesMock }));

const getRideViewMock = vi.hoisted(() => vi.fn());
vi.mock('../ride-view', () => ({ getRideView: getRideViewMock }));

import {
  ALLOWED_CHATBOT_TOOLS,
  PROHIBITED_CHATBOT_ACTIONS,
  isAllowedChatbotTool,
  executeChatbotTool,
  executeGetFareEstimate,
  executeGetPublicProfile,
  executeGetRiderPreferences,
} from './chatbot-tools';
import {
  createPreferenceProposal,
  confirmPreferenceProposal,
  PROPOSAL_TTL_MS,
} from './preference-proposals';

const VIEWER_ID = '11111111-1111-4000-8000-111111111111';
const OTHER_USER_ID = '22222222-2222-4000-8000-222222222222';
const RIDE_ID = '33333333-3333-4000-8000-333333333333';
const NOW = new Date('2026-10-14T10:00:00.000Z');

beforeEach(() => {
  query.mockReset();
  connect.mockReset();
  searchRidesMock.mockReset();
  getRideViewMock.mockReset();
});

describe('Chatbot Tool Allowlist (AI-RD-02, AI-RD-05)', () => {
  it('contains exactly the 6 allowed tools from Deliverable 1 §2', () => {
    expect(ALLOWED_CHATBOT_TOOLS).toEqual([
      'search_rides',
      'get_ride_details',
      'get_fare_estimate',
      'get_public_profile',
      'get_rider_preferences',
      'propose_preference_update',
    ]);
  });

  it('correctly verifies allowed tool names', () => {
    for (const tool of ALLOWED_CHATBOT_TOOLS) {
      expect(isAllowedChatbotTool(tool)).toBe(true);
    }
    expect(isAllowedChatbotTool('join_ride')).toBe(false);
    expect(isAllowedChatbotTool('pay_fare')).toBe(false);
    expect(isAllowedChatbotTool('arbitrary_sql')).toBe(false);
  });

  it('strictly rejects prohibited transactional actions (AI-RD-05)', async () => {
    for (const action of PROHIBITED_CHATBOT_ACTIONS) {
      const result = await executeChatbotTool(VIEWER_ID, action, {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.isProhibited).toBe(true);
        expect(result.error).toContain('Prohibited action');
      }
    }
  });

  it('rejects arbitrary unknown tools', async () => {
    const result = await executeChatbotTool(VIEWER_ID, 'delete_database', {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.isProhibited).toBe(true);
    }
  });
});

describe('search_rides Tool (FR-RD-03.2, AI-RD-02)', () => {
  it('rejects invalid or missing search arguments', async () => {
    const result = await executeChatbotTool(VIEWER_ID, 'search_rides', {});
    expect(result).toEqual({ success: true, tool: 'search_rides', data: [] });
    expect(searchRidesMock).not.toHaveBeenCalled();
  });

  it('invokes searchRides with validated parameters', async () => {
    const mockRides = [
      {
        id: RIDE_ID,
        direction: 'to_hub',
        ownerName: 'Arjun Verma',
        occupantNames: ['Arjun Verma'],
        hub: { name: 'Kanpur Central', detail: null },
        campusLocationName: 'Hall 3',
        departureStart: '2026-10-15T08:00:00+05:30',
        departureEnd: '2026-10-15T08:30:00+05:30',
        vehicleName: 'Auto',
        capacity: 3,
        occupantCount: 1,
        seatsLeft: 2,
        totalFare: 300,
        estimatedShare: 150,
        requestState: null,
      },
    ];
    searchRidesMock.mockResolvedValueOnce(mockRides);

    const validArgs = {
      direction: 'to_hub',
      hubId: 'hub-1',
      campusLocationId: 'loc-1',
      departureStart: '2026-10-15T08:00:00+05:30',
      departureEnd: '2026-10-15T08:30:00+05:30',
    };

    const result = await executeChatbotTool(VIEWER_ID, 'search_rides', validArgs);
    expect(result).toEqual({ success: true, tool: 'search_rides', data: mockRides });
    expect(searchRidesMock).toHaveBeenCalledWith(
      VIEWER_ID,
      expect.objectContaining({
        direction: 'to_hub',
        hubId: 'hub-1',
        campusLocationId: 'loc-1',
      }),
    );
  });
});

describe('get_ride_details Tool (FR-RD-03.6, AI-RD-05)', () => {
  it('returns null for an invalid ride ID', async () => {
    const result = await executeChatbotTool(VIEWER_ID, 'get_ride_details', { rideId: 'bad-id' });
    expect(result).toEqual({ success: true, tool: 'get_ride_details', data: null });
  });

  it('returns sanitized public ride details without private data', async () => {
    const mockRideView = {
      id: RIDE_ID,
      direction: 'to_hub',
      departureStart: '2026-10-15T08:00:00+05:30',
      departureEnd: '2026-10-15T08:30:00+05:30',
      seatsLeft: 2,
      capacity: 3,
      vehicleName: 'Auto',
      totalFare: 300,
      estimatedShare: 150,
      occupants: [
        {
          occupantId: 'occ-1',
          name: 'Arjun Verma',
          campusPlace: 'Hall 3',
          visibleTags: ['Coding', 'Cricket'],
          completedTrips: 12,
          rating: { average: 4.8, count: 5 },
          isOwner: true,
          isViewer: false,
        },
      ],
      trip: {
        stops: [
          {
            place: 'Hall 3',
            estimatedAt: '2026-10-15T08:00:00+05:30',
            occupantIds: ['occ-1'],
            people: ['Arjun Verma'],
          },
        ],
      },
    };
    getRideViewMock.mockResolvedValueOnce(mockRideView);

    const result = await executeChatbotTool(VIEWER_ID, 'get_ride_details', { rideId: RIDE_ID });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.tool).toBe('get_ride_details');
    expect(result.data).toEqual({
      rideId: RIDE_ID,
      direction: 'to_hub',
      departureStart: '2026-10-15T08:00:00+05:30',
      departureEnd: '2026-10-15T08:30:00+05:30',
      seatsLeft: 2,
      capacity: 3,
      vehicleName: 'Auto',
      totalFare: 300,
      estimatedShare: 150,
      owner: {
        name: 'Arjun Verma',
        rating: { average: 4.8, count: 5 },
      },
      occupants: [
        {
          name: 'Arjun Verma',
          campusPlace: 'Hall 3',
          visibleTags: ['Coding', 'Cricket'],
          completedTrips: 12,
          rating: { average: 4.8, count: 5 },
        },
      ],
      itinerary: mockRideView.trip.stops,
    });

    // Ensure private fields never exist on output
    const jsonStr = JSON.stringify(result.data);
    expect(jsonStr).not.toContain('email');
    expect(jsonStr).not.toContain('phone');
    expect(jsonStr).not.toContain('mobile');
  });
});

describe('get_fare_estimate Tool (FR-RD-08.1, AI-RD-02)', () => {
  it('correctly calculates whole rupee fare estimates', async () => {
    // 300 total fare split among 2 existing occupants + 1 joining rider = 3 people => 100
    const res1 = await executeGetFareEstimate({ totalFare: 300, currentOccupants: 2 });
    expect(res1).toEqual({ estimatedShare: 100, totalFare: 300, occupants: 2 });

    // 250 total fare split among 1 existing occupant + 1 joining rider = 2 people => ceil(250/2) = 125
    const res2 = await executeGetFareEstimate({ totalFare: 250, currentOccupants: 1 });
    expect(res2).toEqual({ estimatedShare: 125, totalFare: 250, occupants: 1 });

    // 250 total fare split among 2 existing occupants + 1 joining rider = 3 people => ceil(250/3) = 84
    const res3 = await executeGetFareEstimate({ totalFare: 250, currentOccupants: 2 });
    expect(res3).toEqual({ estimatedShare: 84, totalFare: 250, occupants: 2 });
  });

  it('rejects invalid fare inputs', async () => {
    expect(await executeGetFareEstimate({ totalFare: -50, currentOccupants: 2 })).toBeNull();
    expect(await executeGetFareEstimate({ totalFare: '300', currentOccupants: 2 })).toBeNull();
  });
});

describe('get_public_profile Tool (FR-RD-02.4, FR-RD-05.2, AI-RD-10)', () => {
  it('discloses only display name, visible tags, trips, and rating (if >= 3)', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          display_name: 'Priya Sharma',
          visible_tags: ['Music', 'Badminton'],
          completed_trips: 8,
          rating_count: 5,
          rating_average: 4.9,
        },
      ],
    });

    const result = await executeGetPublicProfile({ userId: OTHER_USER_ID }, NOW);
    expect(result).toEqual({
      displayName: 'Priya Sharma',
      visibleTags: ['Music', 'Badminton'],
      completedTrips: 8,
      aggregateRating: { count: 5, average: 4.9 },
    });

    // Verify SQL does not select private fields
    const sql = query.mock.calls[0][0] as string;
    expect(sql).not.toContain('u.email');
    expect(sql).not.toContain('mobile_number');
    expect(sql).not.toContain('roll_number');
  });

  it('withholds rating average if rating count is less than 3 (P-24, FR-RD-12.3)', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          display_name: 'Rohit Kumar',
          visible_tags: ['Chess'],
          completed_trips: 2,
          rating_count: 2,
          rating_average: 5.0,
        },
      ],
    });

    const result = await executeGetPublicProfile({ displayName: 'Rohit Kumar' }, NOW);
    expect(result).toEqual({
      displayName: 'Rohit Kumar',
      visibleTags: ['Chess'],
      completedTrips: 2,
      aggregateRating: null, // Hidden because count < 3
    });
  });

  it('returns null when user is not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await executeGetPublicProfile({ displayName: 'Nonexistent' }, NOW);
    expect(result).toBeNull();
  });
});

describe('get_rider_preferences Tool (AI-RD-02, AI-RD-10)', () => {
  it('includes tags when aiTagConsent is true', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          pickup_id: 'loc-hall-3',
          pickup_name: 'Hall 3',
          vehicle_id: 'veh-auto',
          vehicle_name: 'Auto',
          max_share: 200,
          ai_tag_consent: true,
        },
      ],
    });
    query.mockResolvedValueOnce({
      rows: [{ id: 'tag-1', name: 'Coding', is_visible: true }],
    });

    const result = await executeGetRiderPreferences(VIEWER_ID);
    expect(result).toEqual({
      defaultPickupPoint: { id: 'loc-hall-3', name: 'Hall 3' },
      preferredVehicleType: { id: 'veh-auto', name: 'Auto' },
      maxAcceptableFareShare: 200,
      aiTagConsent: true,
      interestTags: [{ id: 'tag-1', name: 'Coding', visible: true }],
    });
  });

  it('withholds tags when aiTagConsent is false (AI-RD-10 / FR-RD-16.2)', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          pickup_id: 'loc-hall-1',
          pickup_name: 'Hall 1',
          vehicle_id: null,
          vehicle_name: null,
          max_share: null,
          ai_tag_consent: false,
        },
      ],
    });

    const result = await executeGetRiderPreferences(VIEWER_ID);
    expect(result).toEqual({
      defaultPickupPoint: { id: 'loc-hall-1', name: 'Hall 1' },
      preferredVehicleType: null,
      maxAcceptableFareShare: null,
      aiTagConsent: false,
      interestTags: [], // Empty because rider did not consent
    });
    // Ensured tags table was never queried
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('propose_preference_update and 10-Minute Expiry (FR-RD-05.3, AI-RD-04)', () => {
  it('creates an unconfirmed proposal with before/after diff and 10-minute expiry', async () => {
    // 1. Validation queries
    query.mockResolvedValueOnce({ rows: [{ id: 'loc-hall-6' }] }); // location check
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
    query.mockResolvedValueOnce({ rows: [] }); // tags

    // 3. Names for after values
    query.mockResolvedValueOnce({ rows: [{ id: 'loc-hall-6', name: 'Hall 6' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'veh-cab', name: 'Cab' }] });

    // 4. Insert proposal
    query.mockResolvedValueOnce({ rows: [] });

    const proposal = await createPreferenceProposal(
      VIEWER_ID,
      {
        defaultPickupPointId: 'loc-hall-6',
        preferredVehicleTypeId: 'veh-cab',
        maxAcceptableFareShare: 250,
      },
      NOW,
    );

    expect(proposal.userId).toBe(VIEWER_ID);
    expect(proposal.status).toBe('pending');
    expect(proposal.before).toEqual({
      defaultPickupPoint: { id: 'loc-hall-1', name: 'Hall 1' },
      preferredVehicleType: { id: 'veh-auto', name: 'Auto' },
      maxAcceptableFareShare: 150,
      interestTags: [],
    });
    expect(proposal.after).toEqual({
      defaultPickupPoint: { id: 'loc-hall-6', name: 'Hall 6' },
      preferredVehicleType: { id: 'veh-cab', name: 'Cab' },
      maxAcceptableFareShare: 250,
      interestTags: [],
    });

    const expectedExpiry = new Date(NOW.getTime() + PROPOSAL_TTL_MS).toISOString();
    expect(proposal.expiresAt).toBe(expectedExpiry);
  });

  it('fails confirmation if proposal has expired after 10 minutes (US-RD-14-AC2)', async () => {
    const proposalId = '44444444-4444-4000-8000-444444444444';
    const expiresAt = new Date(NOW.getTime() + PROPOSAL_TTL_MS);

    // Mock client for transaction
    const clientQuery = vi.fn();
    const release = vi.fn();
    connect.mockResolvedValueOnce({
      query: clientQuery,
      release,
    });

    clientQuery.mockResolvedValueOnce({}); // BEGIN
    clientQuery.mockResolvedValueOnce({
      rows: [
        {
          status: 'pending',
          expires_at: expiresAt,
          proposed_changes: { maxAcceptableFareShare: 300 },
        },
      ],
    }); // SELECT FOR UPDATE
    clientQuery.mockResolvedValueOnce({}); // UPDATE status = 'expired'
    clientQuery.mockResolvedValueOnce({}); // COMMIT

    // Confirm at 11 minutes after NOW (expired)
    const after11Mins = new Date(NOW.getTime() + 11 * 60 * 1000);
    const result = await confirmPreferenceProposal(proposalId, VIEWER_ID, after11Mins);

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('succeeds confirmation within the 10-minute window (US-RD-14-AC1)', async () => {
    const proposalId = '55555555-5555-4000-8000-555555555555';
    const expiresAt = new Date(NOW.getTime() + PROPOSAL_TTL_MS);

    const clientQuery = vi.fn();
    const release = vi.fn();
    connect.mockResolvedValueOnce({
      query: clientQuery,
      release,
    });

    clientQuery.mockResolvedValueOnce({}); // BEGIN
    clientQuery.mockResolvedValueOnce({
      rows: [
        {
          status: 'pending',
          expires_at: expiresAt,
          proposed_changes: { maxAcceptableFareShare: 300 },
        },
      ],
    }); // SELECT FOR UPDATE
    clientQuery.mockResolvedValueOnce({}); // UPDATE user_profiles
    clientQuery.mockResolvedValueOnce({}); // UPDATE chatbot_preference_proposals status = 'confirmed'
    clientQuery.mockResolvedValueOnce({}); // COMMIT

    // Confirm at 5 minutes after NOW (within window)
    const at5Mins = new Date(NOW.getTime() + 5 * 60 * 1000);
    const result = await confirmPreferenceProposal(proposalId, VIEWER_ID, at5Mins);

    expect(result.success).toBe(true);
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE user_profiles'),
      expect.arrayContaining([VIEWER_ID, 300]),
    );
  });
});
