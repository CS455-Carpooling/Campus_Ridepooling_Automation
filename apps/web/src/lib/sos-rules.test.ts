import { describe, expect, it } from 'vitest';
import { RIDE_STATES } from './ride-status';
import {
  INCIDENT_STATUSES,
  SOS_RULES,
  canRaiseSos,
  incidentActionRefusal,
  incidentStatusLabels,
  parseIncidentAction,
  parseSosUpdate,
} from './sos-rules';

describe('who may raise an SOS (FR-RD-15.1, FR-RO-13.2)', () => {
  it('is anyone with a seat, only while the trip is under way', () => {
    expect(RIDE_STATES.filter((state) => canRaiseSos(state, true))).toEqual([
      'pickup_in_progress',
      'in_transit',
    ]);
    expect(RIDE_STATES.some((state) => canRaiseSos(state, false))).toBe(false);
  });
});

describe('SOS updates from the person who raised it', () => {
  it('reads a location, with or without its accuracy', () => {
    expect(parseSosUpdate({ latitude: 26.5123, longitude: 80.2329, accuracy: 18 })).toEqual({
      ok: true,
      value: { kind: 'location', latitude: 26.5123, longitude: 80.2329, accuracy: 18 },
    });
    expect(parseSosUpdate({ latitude: -90, longitude: 180 })).toEqual({
      ok: true,
      value: { kind: 'location', latitude: -90, longitude: 180, accuracy: null },
    });
  });

  it('reads a false alarm (FR-RD-15.5)', () => {
    expect(parseSosUpdate({ falseAlarm: true })).toEqual({
      ok: true,
      value: { kind: 'false_alarm' },
    });
  });

  it('refuses anything else', () => {
    for (const body of [
      {},
      null,
      { falseAlarm: 'yes' },
      { latitude: 91, longitude: 80 },
      { latitude: 26, longitude: -181 },
      { latitude: '26', longitude: 80 },
      { latitude: 26, longitude: 80, accuracy: -1 },
      { latitude: Number.NaN, longitude: 80 },
    ]) {
      expect(parseSosUpdate(body).ok).toBe(false);
    }
  });
});

describe('admin actions on an incident', () => {
  it('labels every status in words', () => {
    expect(INCIDENT_STATUSES.map((status) => incidentStatusLabels[status])).toEqual([
      'Open',
      'Acknowledged',
      'Closed',
    ]);
  });

  it('reads Acknowledge, and Close with a note of at most 1000 characters', () => {
    expect(parseIncidentAction({ action: 'acknowledge' })).toEqual({
      ok: true,
      value: { action: 'acknowledge' },
    });
    expect(parseIncidentAction({ action: 'close', note: '  Called the rider; safe.  ' })).toEqual({
      ok: true,
      value: { action: 'close', note: 'Called the rider; safe.' },
    });
    expect(
      parseIncidentAction({ action: 'close', note: 'x'.repeat(SOS_RULES.closeNoteMax) }).ok,
    ).toBe(true);
  });

  it('refuses a close without a note, a note too long, and unknown actions', () => {
    expect(parseIncidentAction({ action: 'close' })).toEqual({
      ok: false,
      errors: { note: expect.any(String) },
    });
    expect(parseIncidentAction({ action: 'close', note: '   ' }).ok).toBe(false);
    expect(
      parseIncidentAction({ action: 'close', note: 'x'.repeat(SOS_RULES.closeNoteMax + 1) }).ok,
    ).toBe(false);
    expect(parseIncidentAction({ action: 'delete' })).toEqual({
      ok: false,
      errors: { action: expect.any(String) },
    });
    expect(parseIncidentAction('close').ok).toBe(false);
  });

  it('moves an incident forward only', () => {
    expect(incidentActionRefusal('open', 'acknowledge')).toBeNull();
    expect(incidentActionRefusal('open', 'close')).toBeNull();
    expect(incidentActionRefusal('acknowledged', 'close')).toBeNull();
    expect(incidentActionRefusal('acknowledged', 'acknowledge')).toBe('already_acknowledged');
    expect(incidentActionRefusal('closed', 'acknowledge')).toBe('closed');
    expect(incidentActionRefusal('closed', 'close')).toBe('closed');
  });
});
