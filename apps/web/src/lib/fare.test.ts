import { describe, expect, it } from 'vitest';
import { estimateShare, splitFare } from './fare';

describe('splitFare (Table T-2)', () => {
  it('reproduces the worked example in D1: 350 between 3 is 117, 117, 116', () => {
    expect(splitFare(350, 3)).toEqual([117, 117, 116]);
  });

  it('gives everyone the same share when the fare divides evenly', () => {
    expect(splitFare(360, 3)).toEqual([120, 120, 120]);
  });

  it('charges the extra rupees to the earliest occupants, owner first', () => {
    expect(splitFare(103, 4)).toEqual([26, 26, 26, 25]);
    expect(splitFare(5, 4)).toEqual([2, 1, 1, 1]);
  });

  it('handles a lone owner and a fare smaller than the number of occupants', () => {
    expect(splitFare(240, 1)).toEqual([240]);
    expect(splitFare(2, 3)).toEqual([1, 1, 0]);
    expect(splitFare(0, 2)).toEqual([0, 0]);
  });

  it('always adds up to the total, with shares at most one rupee apart', () => {
    for (let occupants = 1; occupants <= 8; occupants += 1) {
      for (let total = 0; total <= 1200; total += 7) {
        const shares = splitFare(total, occupants);
        expect(shares).toHaveLength(occupants);
        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
        // Non-increasing: nobody pays more than an occupant ahead of them.
        expect([...shares].sort((a, b) => b - a)).toEqual(shares);
      }
    }
  });

  it.each([
    [-1, 2],
    [10.5, 2],
    [Number.NaN, 2],
    [100, 0],
    [100, 2.5],
  ])('rejects a fare of %s between %s occupants', (total, occupants) => {
    expect(() => splitFare(total, occupants)).toThrow(RangeError);
  });
});

describe('estimateShare (FR-RD-08.1)', () => {
  it('divides by the current occupants plus one and rounds up', () => {
    expect(estimateShare(350, 3)).toBe(88);
    expect(estimateShare(360, 2)).toBe(120);
  });

  it('is never lower than the share actually assigned on joining', () => {
    for (let occupants = 1; occupants <= 7; occupants += 1) {
      for (let total = 0; total <= 1200; total += 13) {
        const assigned = splitFare(total, occupants + 1);
        expect(estimateShare(total, occupants)).toBeGreaterThanOrEqual(Math.max(...assigned));
      }
    }
  });

  it('rejects invalid input', () => {
    expect(() => estimateShare(-5, 2)).toThrow(RangeError);
    expect(() => estimateShare(100, 0)).toThrow(RangeError);
  });
});
