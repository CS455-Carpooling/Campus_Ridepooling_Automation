// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import {
  INCIDENT_LIST_LIMIT,
  getIncident,
  listIncidents,
  listRideIncidents,
  openIncidentSummary,
} from './admin-incident-queries';

const ID = 'a5a5a5a5-5555-4000-8000-000000000001';
const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const raisedAt = new Date('2026-10-13T12:40:00.000Z');

const summaryRow = (change: Record<string, unknown> = {}) => ({
  id: ID,
  reference: 'SOS-1A2B3C4D',
  status: 'open',
  raised_at: raisedAt,
  raiser_name: 'Kabir Shah',
  raised_role: 'rider',
  ride_title: 'To Kanpur Central',
  false_alarm_at: null,
  located_at: null,
  ...change,
});

const context = {
  ride: {
    title: 'To Kanpur Central',
    direction: 'to_hub',
    hub: 'Kanpur Central',
    departureStart: '2026-10-13T12:30:00.000Z',
    departureEnd: '2026-10-13T13:30:00.000Z',
    vehicle: 'Car',
    state: 'in_transit',
  },
  occupants: [],
};

beforeEach(() => query.mockReset());

describe('listIncidents (CS455-65)', () => {
  it('lists open ones first, then acknowledged, then closed, newest first', async () => {
    query.mockResolvedValue({
      rows: [summaryRow({ false_alarm_at: raisedAt, located_at: raisedAt })],
    });
    await expect(listIncidents()).resolves.toEqual([
      {
        id: ID,
        reference: 'SOS-1A2B3C4D',
        status: 'open',
        raisedAt: raisedAt.toISOString(),
        raiserName: 'Kabir Shah',
        raisedRole: 'rider',
        rideTitle: 'To Kanpur Central',
        falseAlarm: true,
        locationShared: true,
      },
    ]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("CASE s.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END");
    expect(params).toEqual([INCIDENT_LIST_LIMIT]);
  });

  it("lists a ride's incidents, and none for an ID that is not a UUID", async () => {
    query.mockResolvedValue({ rows: [summaryRow()] });
    await expect(listRideIncidents(RIDE)).resolves.toHaveLength(1);
    expect(query.mock.calls[0][1]).toEqual([RIDE]);
    await expect(listRideIncidents('nope')).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('getIncident (CS455-65)', () => {
  it('gives the incident in full: snapshot, mobile, location and who handled it', async () => {
    const at = new Date('2026-10-13T12:45:00.000Z');
    query.mockResolvedValue({
      rows: [
        summaryRow({
          status: 'closed',
          located_at: raisedAt,
          ride_id: RIDE,
          raised_by: 'u1',
          trip_state: 'in_transit',
          mobile_number: '9876500001',
          latitude: 26.5123,
          longitude: 80.2329,
          accuracy_m: 14,
          context,
          acknowledged_at: at,
          acknowledged_by_name: 'Ops Admin',
          closed_at: at,
          closed_by_name: null,
          close_note: 'Called the rider; all fine.',
        }),
      ],
    });
    await expect(getIncident(ID)).resolves.toMatchObject({
      rideId: RIDE,
      raiserId: 'u1',
      mobileNumber: '9876500001',
      location: {
        latitude: 26.5123,
        longitude: 80.2329,
        accuracyM: 14,
        at: raisedAt.toISOString(),
      },
      falseAlarmAt: null,
      context,
      acknowledged: { at: at.toISOString(), by: 'Ops Admin' },
      closed: { at: at.toISOString(), by: 'An admin', note: 'Called the rider; all fine.' },
    });
  });

  it('has no location or handling when there is none, and is null when there is no incident', async () => {
    query.mockResolvedValueOnce({
      rows: [
        summaryRow({
          ride_id: RIDE,
          raised_by: 'u1',
          trip_state: 'pickup_in_progress',
          mobile_number: null,
          latitude: null,
          longitude: null,
          accuracy_m: null,
          context,
          acknowledged_at: null,
          acknowledged_by_name: null,
          closed_at: null,
          closed_by_name: null,
          close_note: null,
          false_alarm_at: raisedAt,
        }),
      ],
    });
    await expect(getIncident(ID)).resolves.toMatchObject({
      location: null,
      acknowledged: null,
      closed: null,
      falseAlarmAt: raisedAt.toISOString(),
    });
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getIncident(ID)).resolves.toBeNull();
    await expect(getIncident('nope')).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe('openIncidentSummary (P-22)', () => {
  it('counts alerts nobody acknowledged and names the newest', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { unacknowledged: 2, id: ID, reference: 'SOS-1A2B3C4D', ride_title: 'To Kanpur Central' },
      ],
    });
    await expect(openIncidentSummary()).resolves.toEqual({
      unacknowledged: 2,
      newest: { id: ID, reference: 'SOS-1A2B3C4D', rideTitle: 'To Kanpur Central' },
    });
    query.mockResolvedValueOnce({
      rows: [{ unacknowledged: 0, id: null, reference: null, ride_title: null }],
    });
    await expect(openIncidentSummary()).resolves.toEqual({ unacknowledged: 0, newest: null });
    expect(query.mock.calls[0][0]).toContain("WHERE status = 'open'");
  });
});
