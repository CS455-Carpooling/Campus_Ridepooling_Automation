import { describe, expect, it } from 'vitest';
import { formatDeparture } from './format';

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
