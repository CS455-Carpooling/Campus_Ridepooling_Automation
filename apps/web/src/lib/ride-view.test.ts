import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { UPCOMING_LIMIT, getHistoricalRides, getRideView, getUpcomingRides } from './ride-view';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const VIEWER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

// Departure 06:30 IST on Saturday 10 October 2026, so the ride locks at 05:30 IST.
const open = new Date('2026-10-10T00:00:00+05:30');
const locked = new Date('2026-10-10T05:30:00+05:30');

function rideRow(change: Record<string, unknown> = {}) {
  return {
    id: RIDE_ID,
    direction: 'to_hub',
    state: 'scheduled',
    departure_start: new Date('2026-10-10T06:30:00+05:30'),
    departure_end: new Date('2026-10-10T07:30:00+05:30'),
    completed_at: null,
    capacity_snapshot: 4,
    expected_total_fare: 350,
    hub_name: 'Kanpur Central',
    hub_detail: 'Railway station',
    vehicle_name: 'Car',
    viewer_is_owner: false,
    viewer_is_rider: false,
    ...change,
  };
}

const owner = { full_name: 'Ananya Rao', campus_place: 'Hall 6', is_owner: true, is_viewer: false };
const rider = {
  full_name: 'Kabir Shah',
  campus_place: 'Hall 3',
  is_owner: false,
  is_viewer: false,
};
const third = {
  full_name: 'Meera Iyer',
  campus_place: 'Main Gate',
  is_owner: false,
  is_viewer: false,
};

function respond(ride: object | null, occupants: object[] = [owner]) {
  query.mockResolvedValueOnce({ rows: ride ? [ride] : [] });
  query.mockResolvedValueOnce({ rows: occupants });
}

beforeEach(() => query.mockReset());

describe('getRideView: which rides a viewer may see', () => {
  it('returns null for an ID that is not a UUID, without a query', async () => {
    await expect(getRideView('abc', VIEWER_ID, open)).resolves.toBeNull();
    await expect(getRideView(RIDE_ID, 'dev-student', open)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns null when the ride does not exist, without reading anyone on it', async () => {
    respond(null);
    await expect(getRideView(RIDE_ID, VIEWER_ID, open)).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([RIDE_ID, VIEWER_ID]);
  });

  it('shows an open ride to anyone signed in, with an estimate labelled for joining', async () => {
    respond(rideRow(), [owner, rider]);
    const view = await getRideView(RIDE_ID, VIEWER_ID, open);
    expect(view).toMatchObject({ viewerRole: 'visitor', isOpen: true, viewerShare: null });
    // US-RD-21-AC1: a 350 rupee ride with 2 occupants gives an estimate of 117 (350 / 3, rounded up).
    expect(view?.estimatedShare).toBe(117);
  });

  it.each([
    ['locked', rideRow(), locked],
    ['cancelled', rideRow({ state: 'cancelled' }), open],
    ['completed', rideRow({ state: 'completed' }), open],
    ['in progress', rideRow({ state: 'pickup_in_progress' }), open],
  ])('NFR-RD-09: hides a %s ride from someone not on it', async (_, ride, now) => {
    respond(ride);
    await expect(getRideView(RIDE_ID, VIEWER_ID, now)).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('still shows a full open ride, with no estimate since there is no seat to ask for', async () => {
    respond(rideRow({ capacity_snapshot: 2 }), [owner, rider]);
    const view = await getRideView(RIDE_ID, VIEWER_ID, open);
    expect(view).toMatchObject({ seatsLeft: 0, estimatedShare: null, isOpen: true });
  });

  it('shows the owner and riders their ride in every state, even after it locks', async () => {
    for (const state of ['scheduled', 'pickup_in_progress', 'completed', 'cancelled']) {
      respond(rideRow({ state, viewer_is_owner: true }), [{ ...owner, is_viewer: true }]);
      await expect(getRideView(RIDE_ID, VIEWER_ID, locked)).resolves.toMatchObject({
        viewerRole: 'owner',
        state,
      });
      respond(rideRow({ state, viewer_is_rider: true }), [owner, { ...rider, is_viewer: true }]);
      await expect(getRideView(RIDE_ID, VIEWER_ID, locked)).resolves.toMatchObject({
        viewerRole: 'rider',
      });
    }
  });

  it('treats the owner as the owner even without a riders row', async () => {
    respond(rideRow({ viewer_is_owner: true }), []);
    const view = await getRideView(RIDE_ID, VIEWER_ID, locked);
    expect(view).toMatchObject({ viewerRole: 'owner', occupantCount: 0, viewerShare: null });
    expect(view?.occupants).toEqual([]);
  });
});

describe('getRideView: what the page shows', () => {
  it('FR-RD-08.4: splits the fare owner first, then riders in the order they joined', async () => {
    respond(rideRow({ viewer_is_rider: true }), [owner, { ...rider, is_viewer: true }, third]);
    const view = await getRideView(RIDE_ID, VIEWER_ID, open);
    expect(view?.occupants.map((person) => [person.name, person.share])).toEqual([
      ['Ananya Rao', 117],
      ['Kabir Shah', 117],
      ['Meera Iyer', 116],
    ]);
    expect(view).toMatchObject({ viewerShare: 117, estimatedShare: null, viewerRole: 'rider' });
  });

  it('UC-RO-04: gives capacity, people on board, free seats and the total fare', async () => {
    respond(rideRow({ viewer_is_owner: true }), [{ ...owner, is_viewer: true }, rider]);
    await expect(getRideView(RIDE_ID, VIEWER_ID, open)).resolves.toMatchObject({
      capacity: 4,
      occupantCount: 2,
      seatsLeft: 2,
      totalFare: 350,
      vehicleName: 'Car',
      hub: { name: 'Kanpur Central', detail: 'Railway station' },
      viewerShare: 175,
    });
  });

  it('gives times as ISO strings, the lock an hour before departure, and when it was read', async () => {
    respond(rideRow());
    const view = await getRideView(RIDE_ID, VIEWER_ID, open);
    expect(view).toMatchObject({
      departureStart: '2026-10-10T01:00:00.000Z',
      departureEnd: '2026-10-10T02:00:00.000Z',
      lockAt: '2026-10-10T00:00:00.000Z',
      isLocked: false,
      windowEnded: false,
      readAt: open.toISOString(),
    });
  });

  it('says when the departure window is over, while the state still reads scheduled', async () => {
    respond(rideRow({ viewer_is_owner: true }));
    const after = new Date('2026-10-10T08:00:00+05:30');
    await expect(getRideView(RIDE_ID, VIEWER_ID, after)).resolves.toMatchObject({
      state: 'scheduled',
      isLocked: true,
      isOpen: false,
      windowEnded: true,
    });
  });

  it('copes with a ride that has nobody on it yet', async () => {
    respond(rideRow(), []);
    await expect(getRideView(RIDE_ID, VIEWER_ID, open)).resolves.toMatchObject({
      occupantCount: 0,
      estimatedShare: 350,
    });
  });

  it('FR-RD-02.4: never reads email, roll numbers or passwords, and orders by joining time', async () => {
    respond(rideRow(), [owner]);
    const view = await getRideView(RIDE_ID, VIEWER_ID, open);
    for (const [sql] of query.mock.calls) {
      expect(sql).not.toMatch(/email|roll_number|password/);
    }
    expect(query.mock.calls[1][0]).toContain('m.joined_at');
    expect(JSON.stringify(view)).not.toContain(VIEWER_ID);
  });

  it('FR-RD-02.4: exposes only selected public tags and completed-trip counts', async () => {
    respond(rideRow(), [{ ...owner, visible_tags: ['Quiet ride'], completed_trips: 3 }]);
    await expect(getRideView(RIDE_ID, VIEWER_ID, open)).resolves.toMatchObject({
      occupants: [{ visibleTags: ['Quiet ride'], completedTrips: 3 }],
    });
    const occupantSql = query.mock.calls[1][0] as string;
    expect(occupantSql).toContain('selected.is_visible = true');
    expect(occupantSql).toContain('profile.display_name');
    expect(occupantSql).not.toMatch(/email|roll_number|password|mobile_number/);
  });
});

describe('getUpcomingRides (FR-RD-06.4)', () => {
  it('lists the rides I offered and joined, soonest first, with seats left', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: RIDE_ID,
          direction: 'to_hub',
          hub_name: 'Kanpur Central',
          departure_start: new Date('2026-10-10T06:30:00+05:30'),
          state: 'scheduled',
          is_owner: true,
          seats_left: 3,
        },
        {
          id: 'c2d4e6f8-3333-4000-8000-000000000003',
          direction: 'from_hub',
          hub_name: 'Lucknow airport',
          departure_start: new Date('2026-10-11T14:00:00+05:30'),
          state: 'pickup_in_progress',
          is_owner: false,
          seats_left: 0,
        },
      ],
    });

    await expect(getUpcomingRides(VIEWER_ID, open)).resolves.toEqual([
      {
        rideId: RIDE_ID,
        title: 'To Kanpur Central',
        departure: '2026-10-10T01:00:00.000Z',
        part: 'owner',
        seatsLeft: 3,
        state: 'scheduled',
      },
      {
        rideId: 'c2d4e6f8-3333-4000-8000-000000000003',
        title: 'From Lucknow airport',
        departure: '2026-10-11T08:30:00.000Z',
        part: 'rider',
        seatsLeft: 0,
        state: 'pickup_in_progress',
      },
    ]);
  });

  it('keeps cancelled, completed and past rides out, and shows at most 20', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getUpcomingRides(VIEWER_ID, open);
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([VIEWER_ID, open, UPCOMING_LIMIT]);
    expect(UPCOMING_LIMIT).toBe(20);
    expect(sql).toContain("r.state IN ('pickup_in_progress', 'in_transit')");
    expect(sql).toContain("r.state = 'scheduled' AND r.departure_end > $2");
    expect(sql).toContain('ORDER BY r.departure_start');
    expect(sql).toContain('COUNT(*)::int');
  });

  it('gives the development user, whose ID is not a UUID, no rides and no query', async () => {
    await expect(getUpcomingRides('dev-student', open)).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('getHistoricalRides', () => {
  it('returns the user’s completed, cancelled, and elapsed scheduled rides with details', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: RIDE_ID,
          direction: 'to_hub',
          hub_name: 'Kanpur Central',
          departure_start: new Date('2026-10-02T23:30:00Z'),
          departure_end: new Date('2026-10-03T00:30:00Z'),
          state: 'completed',
          is_owner: false,
          campus_place: 'Hall 3',
          vehicle_name: 'Car',
          total_fare: 350,
          capacity: 4,
          occupant_count: 3,
        },
      ],
    });

    await expect(getHistoricalRides(VIEWER_ID, open)).resolves.toEqual([
      {
        rideId: RIDE_ID,
        title: 'To Kanpur Central',
        departureStart: '2026-10-02T23:30:00.000Z',
        departureEnd: '2026-10-03T00:30:00.000Z',
        part: 'rider',
        campusPlace: 'Hall 3',
        direction: 'to_hub',
        vehicleName: 'Car',
        totalFare: 350,
        capacity: 4,
        occupantCount: 3,
        state: 'completed',
      },
    ]);
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([VIEWER_ID, open]);
    expect(sql).toContain("r.state IN ('completed', 'cancelled')");
    expect(sql).toContain("r.state = 'scheduled' AND r.departure_end <= $2");
    expect(sql).toContain('ORDER BY r.departure_start DESC');
  });

  it('returns no rides for a non-UUID user without querying', async () => {
    await expect(getHistoricalRides('dev-student', open)).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('getRideView: completing a ride (FR-RO-09.4)', () => {
  const started = new Date('2026-10-10T06:30:00+05:30');

  it('lets the owner complete it from the start of the departure window', async () => {
    respond(rideRow({ viewer_is_owner: true }), [{ ...owner, is_viewer: true }]);
    await expect(getRideView(RIDE_ID, VIEWER_ID, started)).resolves.toMatchObject({
      canComplete: true,
      completedAt: null,
    });
    respond(rideRow({ viewer_is_owner: true }), [{ ...owner, is_viewer: true }]);
    await expect(getRideView(RIDE_ID, VIEWER_ID, locked)).resolves.toMatchObject({
      canComplete: false,
    });
  });

  it('never offers it to a rider, nor on a cancelled ride', async () => {
    respond(rideRow({ viewer_is_rider: true }), [owner, { ...rider, is_viewer: true }]);
    await expect(getRideView(RIDE_ID, VIEWER_ID, started)).resolves.toMatchObject({
      canComplete: false,
    });
    respond(rideRow({ viewer_is_owner: true, state: 'cancelled' }), [
      { ...owner, is_viewer: true },
    ]);
    await expect(getRideView(RIDE_ID, VIEWER_ID, started)).resolves.toMatchObject({
      canComplete: false,
    });
  });

  it('gives when a completed ride was completed, and does not offer it again', async () => {
    respond(
      rideRow({
        viewer_is_owner: true,
        state: 'completed',
        completed_at: new Date('2026-10-10T08:05:00+05:30'),
      }),
      [{ ...owner, is_viewer: true }],
    );
    await expect(getRideView(RIDE_ID, VIEWER_ID, started)).resolves.toMatchObject({
      state: 'completed',
      completedAt: '2026-10-10T02:35:00.000Z',
      canComplete: false,
    });
    expect(query.mock.calls[0][0]).toContain('r.completed_at');
  });
});
