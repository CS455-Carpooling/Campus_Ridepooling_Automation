// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  readJson: vi.fn(),
  withAdminAction: vi.fn(),
  createVehicleType: vi.fn(),
  updateVehicleType: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setCampusFare: vi.fn(),
  setExternalFareRange: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({ requireAdminApi: h.requireAdminApi }));
vi.mock('@/lib/auth', () => ({
  readJson: h.readJson,
  json: (body: object, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/admin-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin-actions')>()),
  withAdminAction: h.withAdminAction,
}));
vi.mock('@/lib/admin-config', () => ({
  createVehicleType: h.createVehicleType,
  updateVehicleType: h.updateVehicleType,
  createLocation: h.createLocation,
  updateLocation: h.updateLocation,
  setCampusFare: h.setCampusFare,
  setExternalFareRange: h.setExternalFareRange,
}));

import { PUT as putCampusFare } from './campus-fares/route';
import { PUT as putExternalFare } from './external-fares/route';
import { PATCH as patchLocation } from './locations/[id]/route';
import { POST as postLocation } from './locations/route';
import { PATCH as patchVehicleType } from './vehicle-types/[id]/route';
import { POST as postVehicleType } from './vehicle-types/route';

const admin = { userId: '6f1c2a5e-0000-4000-8000-0000000000aa', role: 'admin' };
const CLIENT = { query: vi.fn() };
const request = () => new Request('http://localhost/api/admin', { method: 'POST' });
const params = <T extends string>(id: T) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminApi.mockResolvedValue({ admin });
  // Runs the action's work on a stand-in client, as withAdminAction does inside its transaction.
  h.withAdminAction.mockImplementation(async (_admin, _meta, run) => run(CLIENT));
});

const saved = <T>(record: T, before: T | null = null) => ({ kind: 'saved', record, before });

describe('admin configuration routes (CS455-50)', () => {
  it('pass on the refusal for anyone but a signed-in admin, and check the origin', async () => {
    h.requireAdminApi.mockResolvedValue({
      response: Response.json({ code: 'not_admin' }, { status: 403 }),
    });
    const res = await postVehicleType(request());
    expect(res.status).toBe(403);
    expect(h.requireAdminApi).toHaveBeenCalledWith({ write: true });
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('refuse an invalid body with a message per field, before any action', async () => {
    h.readJson.mockResolvedValue({ name: 'A', capacity: 99 });
    const res = await postVehicleType(request());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'invalid',
      fields: { name: expect.any(String), capacity: expect.any(String) },
    });
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('add a vehicle type: 201, audited under its new ID', async () => {
    h.readJson.mockResolvedValue({ name: 'E-rickshaw', capacity: 4 });
    const record = {
      id: 'e-rickshaw',
      name: 'E-rickshaw',
      capacity: 4,
      isActive: true,
      sortOrder: 4,
      version: 1,
    };
    h.createVehicleType.mockResolvedValue(saved(record));
    const res = await postVehicleType(request());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ vehicleType: record });
    expect(h.withAdminAction.mock.calls[0][1]).toEqual({
      action: 'vehicle_type.create',
      entityType: 'vehicle_type',
      entityId: 'e-rickshaw',
    });
    expect(h.createVehicleType).toHaveBeenCalledWith(CLIENT, { name: 'E-rickshaw', capacity: 4 });
  });

  it('edit a vehicle type, and answer 409 with the current one on a stale edit', async () => {
    h.readJson.mockResolvedValue({ isActive: false, version: 3 });
    h.updateVehicleType.mockResolvedValue({
      kind: 'version_conflict',
      current: { id: 'auto', version: 4 },
    });
    const res = await patchVehicleType(request(), params('auto') as never);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: 'version_conflict',
      current: { id: 'auto', version: 4 },
    });
    expect(h.updateVehicleType).toHaveBeenCalledWith(CLIENT, 'auto', {
      isActive: false,
      version: 3,
    });
  });

  it('answer 404 for an ID that cannot be a vehicle type or place, without an action', async () => {
    const res = await patchVehicleType(request(), params('../x') as never);
    expect(res.status).toBe(404);
    const place = await patchLocation(request(), params('Hall 6') as never);
    expect(place.status).toBe(404);
    expect(h.withAdminAction).not.toHaveBeenCalled();
  });

  it('add and edit places', async () => {
    h.readJson.mockResolvedValue({ type: 'transport_hub', name: 'Lucknow Airport' });
    h.createLocation.mockResolvedValue(saved({ id: 'lucknow-airport' }));
    const created = await postLocation(request());
    expect(created.status).toBe(201);
    expect(h.withAdminAction.mock.calls[0][1]).toMatchObject({
      action: 'location.create',
      entityId: 'lucknow-airport',
    });

    h.readJson.mockResolvedValue({ detail: null, version: 2 });
    h.updateLocation.mockResolvedValue(saved({ id: 'kanpur-central', version: 3 }));
    const edited = await patchLocation(request(), params('kanpur-central') as never);
    expect(edited.status).toBe(200);
    expect(await edited.json()).toEqual({ location: { id: 'kanpur-central', version: 3 } });
    expect(h.updateLocation).toHaveBeenCalledWith(CLIENT, 'kanpur-central', {
      detail: null,
      version: 2,
    });
  });

  it('set a campus fare, in place order, by the signed-in admin', async () => {
    h.readJson.mockResolvedValue({
      fromId: 'hall-6',
      toId: 'hall-1',
      vehicleTypeId: 'auto',
      fare: 50,
      version: null,
    });
    h.setCampusFare.mockResolvedValue(
      saved({ fromId: 'hall-1', toId: 'hall-6', vehicleTypeId: 'auto', fare: 50 }),
    );
    const res = await putCampusFare(request());
    expect(res.status).toBe(200);
    expect(h.setCampusFare).toHaveBeenCalledWith(
      CLIENT,
      { fromId: 'hall-1', toId: 'hall-6', vehicleTypeId: 'auto', fare: 50, version: null },
      admin.userId,
    );
    expect(h.withAdminAction.mock.calls[0][1]).toMatchObject({ entityId: 'hall-1:hall-6:auto' });
  });

  it('set an external range, and pass on field refusals from the database checks', async () => {
    h.readJson.mockResolvedValue({
      hubId: 'hall-6',
      vehicleTypeId: 'auto',
      minFare: 200,
      maxFare: 300,
      version: null,
    });
    h.setExternalFareRange.mockResolvedValue({
      kind: 'invalid',
      fields: { hubId: 'Choose a hub from the list.' },
    });
    const res = await putExternalFare(request());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ fields: { hubId: 'Choose a hub from the list.' } });

    h.readJson.mockResolvedValue({
      hubId: 'kanpur-central',
      vehicleTypeId: 'auto',
      minFare: 400,
      maxFare: 300,
    });
    const reversed = await putExternalFare(request());
    expect(reversed.status).toBe(400);
  });

  it('answer 404 when the item was not found inside the action', async () => {
    h.readJson.mockResolvedValue({ name: 'Car', version: 1 });
    h.updateVehicleType.mockResolvedValue({ kind: 'not_found' });
    const res = await patchVehicleType(request(), params('jet') as never);
    expect(res.status).toBe(404);
  });
});
