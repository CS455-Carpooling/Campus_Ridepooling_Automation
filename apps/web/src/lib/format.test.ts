import { describe, expect, it } from 'vitest';
import {
  formatDeparture,
  formatDepartureWindow,
  formatRating,
  formatRupees,
  formatTimeOfDay,
} from './format';

describe('formatDeparture', () => {
  it('shows a UTC time in Indian Standard Time', () => {
    expect(formatDeparture('2026-10-02T23:30:00Z')).toBe('Sat 3 Oct, 05:00');
  });

  it('keeps a time already given in IST', () => {
    expect(formatDeparture('2026-10-03T12:05:00+05:30')).toBe('Sat 3 Oct, 12:05');
  });

  it('moves to the next day and year when IST is past midnight', () => {
    expect(formatDeparture('2026-12-31T18:45:00Z')).toBe('Fri 1 Jan, 00:15');
  });
});

describe('formatRupees', () => {
  const rupee = String.fromCodePoint(0x20b9);

  it('puts the rupee sign before whole rupees', () => {
    expect(formatRupees(117)).toBe(`${rupee}117`);
    expect(formatRupees(0)).toBe(`${rupee}0`);
  });

  it('groups digits the Indian way', () => {
    expect(formatRupees(50000)).toBe(`${rupee}50,000`);
    expect(formatRupees(100000)).toBe(`${rupee}1,00,000`);
  });
});

describe('formatDepartureWindow', () => {
  it('shows the day once for a window within one day', () => {
    expect(formatDepartureWindow('2026-10-10T06:30:00+05:30', '2026-10-10T07:30:00+05:30')).toBe(
      'Sat 10 Oct, 06:30 to 07:30',
    );
  });

  it('repeats the day when the window crosses midnight in IST', () => {
    expect(formatDepartureWindow('2026-10-10T23:30:00+05:30', '2026-10-11T01:00:00+05:30')).toBe(
      'Sat 10 Oct, 23:30 to Sun 11 Oct, 01:00',
    );
  });
});

describe('formatTimeOfDay', () => {
  it('shows the time in IST with seconds, on a 24-hour clock', () => {
    expect(formatTimeOfDay('2026-10-05T15:42:05Z')).toBe('21:12:05');
    expect(formatTimeOfDay('2026-10-05T18:30:00Z')).toBe('00:00:00');
  });
});

describe('formatRating', () => {
  it('gives the average to one decimal with how many ratings it rests on', () => {
    expect(formatRating({ average: 4.3, count: 7 })).toBe('4.3 out of 5 from 7 ratings');
    expect(formatRating({ average: 5, count: 3 })).toBe('5.0 out of 5 from 3 ratings');
  });
});
