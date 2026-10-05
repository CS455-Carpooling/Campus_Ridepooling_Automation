import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RIDE_STATES, rideStateLabels } from '@/lib/ride-status';
import { RideStateLabel } from './RideStateLabel';

describe('RideStateLabel', () => {
  it('NFR-RO-USE-04: names every state in text, each with its own look', () => {
    const looks = new Set<string>();
    for (const state of RIDE_STATES) {
      const { unmount } = render(<RideStateLabel state={state} />);
      const label = screen.getByText(rideStateLabels[state]);
      looks.add(label.className);
      unmount();
    }
    // In progress and in transit share the "under way" look; the rest differ.
    expect(looks.size).toBe(4);
  });
});
