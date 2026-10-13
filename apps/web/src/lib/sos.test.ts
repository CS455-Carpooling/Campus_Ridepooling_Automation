// @vitest-environment node
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { raiseSos, updateSos, type SosContext } from './sos';

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const OWNER = '6f1c2a5e-2222-4000-8000-000000000001';
const RIDER = '6f1c2a5e-2222-4000-8000-000000000002';
const STRANGER = '6f1c2a5e-2222-4000-8000-0000000000ff';
const INCIDENT = 'a5a5a5a5-5555-4000-8000-000000000001';
const now = new Date('2026-10-13T12:40:00.000Z');

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

const incidentRow = (change: Record<string, unknown> = {}) => ({
  id: INCIDENT,
  reference: 'SOS-1A2B3C4D',
  raised_at: now,
  status: 'open',
  located_at: null,
  false_alarm_at: null,
  ...change,
});

function sosClient(
  options: {
    ride?: Record<string, unknown> | null;
    riderLeft?: boolean;
    riderNoShow?: boolean;
    inserted?: boolean;
    existing?: Record<string, unknown> | null;
  } = {},
) {
  const query = vi.fn<Query>(async (sql, params) => {
    if (sql.includes('FROM rides r')) {
      return {
        rows:
          options.ride === null
            ? []
            : [
                {
                  id: RIDE,
                  owner_id: OWNER,
                  state: 'in_transit',
                  direction: 'to_hub',
                  departure_start: new Date('2026-10-13T12:30:00.000Z'),
                  departure_end: new Date('2026-10-13T13:30:00.000Z'),
                  hub_name: 'Kanpur Central',
                  vehicle_name: 'Car',
                  ...options.ride,
                },
              ],
      };
    }
    if (sql.includes('FROM riders m')) {
      return {
        rows: [
          {
            user_id: OWNER,
            name: 'Ananya Rao',
            is_owner: true,
            place: 'Hall 1',
            left_at: null,
            checked_in_at: null,
            arrived_at: null,
            no_show_at: null,
          },
          {
            user_id: RIDER,
            name: 'Kabir Shah',
            is_owner: false,
            place: 'Hall 2',
            left_at: options.riderLeft ? now : null,
            checked_in_at: now,
            arrived_at: now,
            no_show_at: options.riderNoShow ? now : null,
          },
        ],
      };
    }
    if (sql.includes('INSERT INTO sos_incidents')) {
      return { rows: options.inserted === false ? [] : [incidentRow({ raised_at: params?.[4] })] };
    }
    if (sql.includes('FROM sos_incidents') && sql.includes('FOR UPDATE')) {
      return { rows: options.existing === null ? [] : [incidentRow(options.existing ?? {})] };
    }
    if (sql.includes('FROM sos_incidents'))
      return { rows: [incidentRow({ raised_at: new Date('2026-10-13T12:35:00.000Z') })] };
    if (sql.includes('UPDATE sos_incidents')) {
      return {
        rows: [
          incidentRow(
            sql.includes('SET false_alarm_at')
              ? { false_alarm_at: params?.[1] }
              : { located_at: params?.[4] },
          ),
        ],
      };
    }
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, query };
}

const calls = (query: ReturnType<typeof vi.fn>, text: string) =>
  query.mock.calls.filter(([sql]) => String(sql).includes(text));

describe('raiseSos (FR-RD-15.1, 15.2, FR-RO-13.2)', () => {
  it("stores the alert with a snapshot of the trip and the raiser's mobile number", async () => {
    const { client, query } = sosClient();
    const result = await raiseSos(client, RIDE, RIDER, now);
    expect(result).toEqual({
      kind: 'done',
      value: {
        created: true,
        incident: {
          id: INCIDENT,
          reference: 'SOS-1A2B3C4D',
          raisedAt: now.toISOString(),
          status: 'open',
          locationShared: false,
          falseAlarm: false,
        },
      },
    });
    const [insert] = calls(query, 'INSERT INTO sos_incidents');
    expect(insert[0]).toContain('SELECT mobile_number FROM user_profiles WHERE user_id = $2');
    expect(insert[0]).toContain("ON CONFLICT (ride_id, raised_by) WHERE status <> 'closed'");
    expect(insert[1]?.slice(0, 5)).toEqual([RIDE, RIDER, 'rider', 'in_transit', now]);
    const context = JSON.parse(String(insert[1]?.[5])) as SosContext;
    expect(context.ride).toMatchObject({
      title: 'To Kanpur Central',
      vehicle: 'Car',
      state: 'in_transit',
    });
    expect(context.occupants).toEqual([
      {
        userId: OWNER,
        name: 'Ananya Rao',
        role: 'owner',
        place: 'Hall 1',
        status: 'waiting',
        raisedTheAlert: false,
      },
      {
        userId: RIDER,
        name: 'Kabir Shah',
        role: 'rider',
        place: 'Hall 2',
        status: 'arrived',
        raisedTheAlert: true,
      },
    ]);
  });

  it('never tells anyone on the ride (FR-RD-15.4)', async () => {
    const { client, query } = sosClient();
    await raiseSos(client, RIDE, OWNER, now);
    expect(calls(query, 'notifications')).toHaveLength(0);
    expect(calls(query, 'INSERT INTO sos_incidents')[0][1]?.[2]).toBe('owner');
  });

  it('does not allow a no-show to raise SOS or include them as an occupant', async () => {
    await expect(
      raiseSos(sosClient({ riderNoShow: true }).client, RIDE, RIDER, now),
    ).resolves.toEqual({ kind: 'not_found' });

    const { client, query } = sosClient({ riderNoShow: true });
    await raiseSos(client, RIDE, OWNER, now);
    const [insert] = calls(query, 'INSERT INTO sos_incidents');
    const context = JSON.parse(String(insert[1]?.[5])) as SosContext;
    expect(context.occupants.map((occupant) => occupant.userId)).toEqual([OWNER]);
  });

  it('returns the alert already active when pressed again', async () => {
    const { client } = sosClient({ inserted: false });
    await expect(raiseSos(client, RIDE, RIDER, now)).resolves.toMatchObject({
      kind: 'done',
      value: { created: false, incident: { raisedAt: '2026-10-13T12:35:00.000Z' } },
    });
  });

  it('refuses outside the trip, and answers not found to anyone without a seat', async () => {
    await expect(
      raiseSos(sosClient({ ride: { state: 'scheduled' } }).client, RIDE, RIDER, now),
    ).resolves.toEqual({ kind: 'refused', code: 'not_active' });
    await expect(raiseSos(sosClient().client, RIDE, STRANGER, now)).resolves.toEqual({
      kind: 'not_found',
    });
    await expect(
      raiseSos(sosClient({ riderLeft: true }).client, RIDE, RIDER, now),
    ).resolves.toEqual({
      kind: 'not_found',
    });
    await expect(raiseSos(sosClient({ ride: null }).client, RIDE, RIDER, now)).resolves.toEqual({
      kind: 'not_found',
    });
  });
});

describe('updateSos (FR-RD-15.2, 15.5)', () => {
  const location = { kind: 'location' as const, latitude: 26.5, longitude: 80.2, accuracy: 15 };

  it('adds the location once', async () => {
    const { client, query } = sosClient();
    await expect(updateSos(client, INCIDENT, RIDER, location, now)).resolves.toMatchObject({
      kind: 'done',
      value: { locationShared: true },
    });
    expect(calls(query, 'UPDATE sos_incidents')[0][1]).toEqual([INCIDENT, 26.5, 80.2, 15, now]);

    const again = sosClient({ existing: { located_at: now } });
    await expect(updateSos(again.client, INCIDENT, RIDER, location, now)).resolves.toMatchObject({
      value: { locationShared: true },
    });
    expect(calls(again.query, 'UPDATE sos_incidents')).toHaveLength(0);
  });

  it('marks a false alarm once, keeping the alert', async () => {
    const { client, query } = sosClient();
    await expect(
      updateSos(client, INCIDENT, RIDER, { kind: 'false_alarm' }, now),
    ).resolves.toMatchObject({
      value: { falseAlarm: true, status: 'open' },
    });
    expect(calls(query, 'SET false_alarm_at = $2')).toHaveLength(1);

    const again = sosClient({ existing: { false_alarm_at: now } });
    await updateSos(again.client, INCIDENT, RIDER, { kind: 'false_alarm' }, now);
    expect(calls(again.query, 'UPDATE sos_incidents')).toHaveLength(0);
  });

  it('answers not found to anyone but the raiser, and refuses a closed alert', async () => {
    const { client, query } = sosClient({ existing: null });
    await expect(updateSos(client, INCIDENT, STRANGER, location, now)).resolves.toEqual({
      kind: 'not_found',
    });
    expect(calls(query, 'raised_by = $2')[0][1]).toEqual([INCIDENT, STRANGER]);
    await expect(
      updateSos(
        sosClient({ existing: { status: 'closed' } }).client,
        INCIDENT,
        RIDER,
        location,
        now,
      ),
    ).resolves.toEqual({ kind: 'refused', code: 'closed' });
  });
});
