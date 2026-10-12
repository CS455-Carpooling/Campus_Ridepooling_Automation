import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRIP_POLL_MS, TripRefresh, useNow, useTripRefresh } from './trip-hooks';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const fetchMock = vi.fn();
let stamps: Array<string | null>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  stamps = [];
  fetchMock.mockImplementation(async () => {
    const stamp = stamps.length > 1 ? stamps.shift()! : (stamps[0] ?? 'a');
    if (stamp === null) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify({ state: 'pickup_in_progress', stamp }), { status: 200 });
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

/** Runs the timers and lets the fetches settle. */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useTripRefresh (P-13)', () => {
  it('asks for the stamp every 2 seconds and reads the page again only when it changes', async () => {
    stamps = ['a', 'a', 'b', 'b'];
    renderHook(() => useTripRefresh(RIDE_ID, true));
    await tick(0);
    expect(fetchMock).toHaveBeenCalledWith(`/api/rides/${RIDE_ID}/trip`, { cache: 'no-store' });
    expect(router.refresh).not.toHaveBeenCalled();
    await tick(TRIP_POLL_MS);
    expect(router.refresh).not.toHaveBeenCalled();
    await tick(TRIP_POLL_MS);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await tick(TRIP_POLL_MS);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing while inactive, and stops when unmounted', async () => {
    const { rerender, unmount } = renderHook(({ active }) => useTripRefresh(RIDE_ID, active), {
      initialProps: { active: false },
    });
    await tick(TRIP_POLL_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ active: true });
    await tick(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
    await tick(TRIP_POLL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips ticks while the tab is hidden, and shrugs off failed answers', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    renderHook(() => useTripRefresh(RIDE_ID, true));
    await tick(TRIP_POLL_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    stamps = [null];
    await tick(TRIP_POLL_MS);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await tick(TRIP_POLL_MS);
    fetchMock.mockResolvedValueOnce(new Response('{"stamp":5}', { status: 200 }));
    await tick(TRIP_POLL_MS);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('TripRefresh mounts the hook and renders nothing', async () => {
    const { container } = render(<TripRefresh rideId={RIDE_ID} active />);
    expect(container).toBeEmptyDOMElement();
    await tick(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('useNow', () => {
  it('reads the clock again every interval', async () => {
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    const { result } = renderHook(() => useNow(5000));
    expect(result.current.toISOString()).toBe('2026-10-13T12:00:00.000Z');
    await tick(5000);
    expect(result.current.toISOString()).toBe('2026-10-13T12:00:05.000Z');
  });
});
