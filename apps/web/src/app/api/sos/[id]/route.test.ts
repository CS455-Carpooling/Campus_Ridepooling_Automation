// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  readJson: vi.fn(),
  runTripChange: vi.fn(),
  updateSos: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  readJson: h.readJson,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/sos', () => ({ updateSos: h.updateSos }));
vi.mock('@/lib/trip-api', () => ({ runTripChange: h.runTripChange }));

import { PATCH } from './route';

const INCIDENT = 'a5a5a5a5-5555-4000-8000-000000000001';
const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';

const ctx = (id = INCIDENT) =>
  ({ params: Promise.resolve({ id }) }) as RouteContext<'/api/sos/[id]'>;
const request = () => new Request(`http://localhost/api/sos/${INCIDENT}`, { method: 'PATCH' });

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER_ID });
  h.readJson.mockResolvedValue({ latitude: 26.5, longitude: 80.2 });
  h.runTripChange.mockResolvedValue(Response.json({ incident: {} }));
});

describe('PATCH /api/sos/[id] (FR-RD-15.2, 15.5)', () => {
  it('adds the location for the person who raised it', async () => {
    expect((await PATCH(request(), ctx())).status).toBe(200);
    expect(h.guard).toHaveBeenCalledWith('sos-update', 30, 900);
    const [label, , run, body, options] = h.runTripChange.mock.calls[0];
    expect(label).toBe('SOS update');
    expect(options).toEqual({ notFound: 'SOS alert not found.' });
    await run('client');
    expect(h.updateSos).toHaveBeenCalledWith(
      'client',
      INCIDENT,
      USER_ID,
      { kind: 'location', latitude: 26.5, longitude: 80.2, accuracy: null },
      expect.any(Date),
    );
    expect(body({ id: INCIDENT })).toEqual({ incident: { id: INCIDENT } });
  });

  it('marks a false alarm', async () => {
    h.readJson.mockResolvedValue({ falseAlarm: true });
    await PATCH(request(), ctx());
    await h.runTripChange.mock.calls[0][2]('client');
    expect(h.updateSos.mock.calls[0][3]).toEqual({ kind: 'false_alarm' });
  });

  it('refuses a bad body with 400, and checks the rate limit, sign-in and ID first', async () => {
    h.readJson.mockResolvedValue({ latitude: 200, longitude: 0 });
    const invalid = await PATCH(request(), ctx());
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'invalid' });

    h.guard.mockResolvedValueOnce(Response.json({}, { status: 429 }));
    expect((await PATCH(request(), ctx())).status).toBe(429);
    const unknown = await PATCH(request(), ctx('nope'));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'SOS alert not found.', code: 'not_found' });
    h.getCurrentUser.mockResolvedValue(null);
    expect((await PATCH(request(), ctx())).status).toBe(401);
    expect(h.runTripChange).not.toHaveBeenCalled();
  });
});
