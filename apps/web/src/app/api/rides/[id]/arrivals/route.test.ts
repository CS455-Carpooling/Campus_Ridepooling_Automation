// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  runTripChange: vi.fn(),
  markNoShow: vi.fn(),
  setArrival: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/trip', () => ({ markNoShow: h.markNoShow, setArrival: h.setArrival }));
vi.mock('@/lib/trip-api', () => ({ runTripChange: h.runTripChange }));

import { POST } from './route';

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';
const SEAT = '2b0f1f8e-4c1a-4a43-9b51-0d7f2b7c9a10';

const ctx = (id = RIDE_ID) =>
  ({ params: Promise.resolve({ id }) }) as RouteContext<'/api/rides/[id]/arrivals'>;
const request = () =>
  new Request(`http://localhost/api/rides/${RIDE_ID}/arrivals`, { method: 'POST' });

async function runWith(body: object) {
  h.readJson.mockResolvedValue(body);
  await POST(request(), ctx());
  const [label, messages, run, answer] = h.runTripChange.mock.calls.at(-1)!;
  await run('client');
  return { label, messages, answer };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.runTripChange.mockResolvedValue(Response.json({ seat: {} }));
});

describe('POST /api/rides/[id]/arrivals (FR-RO-09.3, FR-RO-10)', () => {
  it('marks a rider arrived, or undoes it, by seat', async () => {
    const { label, messages, answer } = await runWith({ occupantId: SEAT, status: 'arrived' });
    expect(label).toBe('Trip arrival');
    expect(messages).toHaveProperty('grace_period');
    expect(h.setArrival).toHaveBeenCalledWith(
      'client',
      RIDE_ID,
      USER_ID,
      SEAT,
      true,
      expect.any(Date),
    );
    expect(answer({ occupantId: SEAT })).toEqual({ seat: { occupantId: SEAT } });

    await runWith({ occupantId: SEAT, status: 'not_arrived' });
    expect(h.setArrival).toHaveBeenLastCalledWith(
      'client',
      RIDE_ID,
      USER_ID,
      SEAT,
      false,
      expect.any(Date),
    );
  });

  it('marks a no-show', async () => {
    await runWith({ occupantId: SEAT, status: 'no_show' });
    expect(h.markNoShow).toHaveBeenCalledWith('client', RIDE_ID, USER_ID, SEAT, expect.any(Date));
    expect(h.setArrival).not.toHaveBeenCalled();
  });

  it('refuses a body without a seat or status with 400', async () => {
    h.readJson.mockResolvedValue({ occupantId: 'me', status: 'late' });
    const response = await POST(request(), ctx());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'invalid',
      fields: { occupantId: expect.any(String), status: expect.any(String) },
    });
  });

  it('checks the rate limit, sign-in and the ride ID first', async () => {
    h.guard.mockResolvedValueOnce(Response.json({}, { status: 429 }));
    expect((await POST(request(), ctx())).status).toBe(429);
    expect(h.guard).toHaveBeenCalledWith('trip-arrival', 120, 900);
    expect((await POST(request(), ctx('nope'))).status).toBe(404);
    h.getCurrentUser.mockResolvedValue(null);
    expect((await POST(request(), ctx())).status).toBe(401);
    expect(h.runTripChange).not.toHaveBeenCalled();
  });
});
