import { describe, expect, it } from 'vitest';
import {
  ADMIN_CONFIG_RULES,
  adminConfigMessages,
  idFromName,
  locationTypeLabels,
  parseCampusFare,
  parseExternalFareRange,
  parseLocationCreate,
  parseLocationUpdate,
  parseVehicleTypeCreate,
  parseVehicleTypeUpdate,
} from './admin-config-rules';

describe('limits', () => {
  it('uses the same fare limits as creating a ride', () => {
    expect(ADMIN_CONFIG_RULES).toEqual({
      nameMin: 2,
      nameMax: 40,
      detailMax: 80,
      capacityMin: 1,
      capacityMax: 12,
      fareMin: 1,
      fareMax: 50_000,
    });
    expect(locationTypeLabels).toEqual({ campus: 'Campus place', transport_hub: 'Transport hub' });
  });

  it('OA-FR-06: makes a stable ID from a name', () => {
    expect(idFromName('Hall 15')).toBe('hall-15');
    expect(idFromName('  Kanpur  Central (East) ')).toBe('kanpur-central-east');
    expect(idFromName('कानपुर')).toBe('');
  });
});

describe('vehicle types (OA-FR-01 to 03)', () => {
  it('accepts a new vehicle type, tidying the name', () => {
    expect(parseVehicleTypeCreate({ name: '  E   rickshaw ', capacity: 4 })).toEqual({
      ok: true,
      value: { name: 'E rickshaw', capacity: 4 },
    });
  });

  it.each([
    ['a one-letter name', { name: 'E', capacity: 4 }, 'name'],
    ['a name over 40 characters', { name: 'x'.repeat(41), capacity: 4 }, 'name'],
    ['no seats', { name: 'Cab', capacity: 0 }, 'capacity'],
    ['13 seats', { name: 'Cab', capacity: 13 }, 'capacity'],
    ['half a seat', { name: 'Cab', capacity: 3.5 }, 'capacity'],
    ['seats as text', { name: 'Cab', capacity: '4' }, 'capacity'],
  ])('refuses %s', (_case, body, field) => {
    const result = parseVehicleTypeCreate(body);
    expect(result.ok).toBe(false);
    expect(result.ok ? {} : result.errors).toHaveProperty(field);
  });

  it('SYS-NFR-04: an edit names the version it read, and may change one thing only', () => {
    expect(parseVehicleTypeUpdate({ capacity: 6, version: 3 })).toEqual({
      ok: true,
      value: { capacity: 6, version: 3 },
    });
    expect(parseVehicleTypeUpdate({ name: 'Cab', isActive: false, version: 1 })).toEqual({
      ok: true,
      value: { name: 'Cab', isActive: false, version: 1 },
    });
    expect(parseVehicleTypeUpdate({ capacity: 6 })).toEqual({
      ok: false,
      errors: { version: adminConfigMessages.version },
    });
    expect(parseVehicleTypeUpdate({ name: 'x', capacity: 99, isActive: 'no', version: 0 })).toEqual(
      {
        ok: false,
        errors: {
          name: adminConfigMessages.name,
          capacity: adminConfigMessages.capacity,
          isActive: adminConfigMessages.isActive,
          version: adminConfigMessages.version,
        },
      },
    );
  });
});

describe('places and hubs (OA-FR-05 to 07)', () => {
  it('accepts a new place, with or without a detail', () => {
    expect(
      parseLocationCreate({
        type: 'transport_hub',
        name: 'Kanpur bus stand',
        detail: ' Jhakarkati ',
      }),
    ).toEqual({
      ok: true,
      value: { type: 'transport_hub', name: 'Kanpur bus stand', detail: 'Jhakarkati' },
    });
    expect(parseLocationCreate({ type: 'campus', name: 'Hall 15', detail: '   ' })).toEqual({
      ok: true,
      value: { type: 'campus', name: 'Hall 15', detail: null },
    });
  });

  it('refuses an unknown type, a bad name and a long detail', () => {
    expect(parseLocationCreate({ type: 'airport', name: 'H', detail: 'x'.repeat(81) })).toEqual({
      ok: false,
      errors: {
        type: adminConfigMessages.type,
        name: adminConfigMessages.name,
        detail: adminConfigMessages.detail,
      },
    });
    expect(parseLocationCreate({ type: 'campus', name: 'Hall 15', detail: 5 })).toMatchObject({
      ok: false,
      errors: { detail: adminConfigMessages.detail },
    });
  });

  it('edits a name or detail, clears a detail, deactivates, and never changes the type', () => {
    expect(parseLocationUpdate({ detail: null, version: 2 })).toEqual({
      ok: true,
      value: { detail: null, version: 2 },
    });
    expect(
      parseLocationUpdate({ name: 'Hall Fifteen', isActive: false, type: 'campus', version: 2 }),
    ).toEqual({
      ok: true,
      value: { name: 'Hall Fifteen', isActive: false, version: 2 },
    });
    expect(parseLocationUpdate({ name: '', detail: 7, isActive: 1, version: 'x' })).toEqual({
      ok: false,
      errors: {
        name: adminConfigMessages.name,
        detail: adminConfigMessages.detail,
        isActive: adminConfigMessages.isActive,
        version: adminConfigMessages.version,
      },
    });
  });
});

describe('fares (OA-FR-10, 11)', () => {
  it('stores a campus pair in ID order, new (no version) or edited', () => {
    expect(
      parseCampusFare({ fromId: 'hall-5', toId: 'hall-3', vehicleTypeId: 'car', fare: 60 }),
    ).toEqual({
      ok: true,
      value: { fromId: 'hall-3', toId: 'hall-5', vehicleTypeId: 'car', fare: 60, version: null },
    });
    expect(
      parseCampusFare({
        fromId: 'hall-3',
        toId: 'hall-5',
        vehicleTypeId: 'car',
        fare: 60,
        version: 2,
      }),
    ).toMatchObject({
      ok: true,
      value: { version: 2 },
    });
  });

  it('refuses the same place twice, unknown IDs, bad fares and versions', () => {
    expect(
      parseCampusFare({ fromId: 'hall-3', toId: 'hall-3', vehicleTypeId: 'car', fare: 60 }),
    ).toEqual({
      ok: false,
      errors: { toId: adminConfigMessages.samePlace },
    });
    expect(
      parseCampusFare({ fromId: 'Hall 3', toId: 7, vehicleTypeId: '', fare: 0, version: -1 }),
    ).toEqual({
      ok: false,
      errors: {
        fromId: adminConfigMessages.place,
        toId: adminConfigMessages.place,
        vehicleTypeId: adminConfigMessages.vehicleType,
        fare: adminConfigMessages.fare,
        version: adminConfigMessages.version,
      },
    });
  });

  it('SYS-FR-12: accepts an external range only when its lowest fare is not above its highest', () => {
    expect(
      parseExternalFareRange({
        hubId: 'kanpur-central',
        vehicleTypeId: 'car',
        minFare: 300,
        maxFare: 450,
      }),
    ).toEqual({
      ok: true,
      value: {
        hubId: 'kanpur-central',
        vehicleTypeId: 'car',
        minFare: 300,
        maxFare: 450,
        version: null,
      },
    });
    expect(
      parseExternalFareRange({
        hubId: 'kanpur-central',
        vehicleTypeId: 'car',
        minFare: 300,
        maxFare: 300,
        version: 1,
      }).ok,
    ).toBe(true);
    expect(
      parseExternalFareRange({
        hubId: 'kanpur-central',
        vehicleTypeId: 'car',
        minFare: 500,
        maxFare: 300,
      }),
    ).toEqual({
      ok: false,
      errors: { maxFare: adminConfigMessages.range },
    });
    expect(
      parseExternalFareRange({
        hubId: '',
        vehicleTypeId: '',
        minFare: 0,
        maxFare: 60_000,
        version: 1.5,
      }),
    ).toEqual({
      ok: false,
      errors: {
        hubId: adminConfigMessages.place,
        vehicleTypeId: adminConfigMessages.vehicleType,
        minFare: adminConfigMessages.fare,
        maxFare: adminConfigMessages.fare,
        version: adminConfigMessages.version,
      },
    });
    expect(parseExternalFareRange(null)).toMatchObject({ ok: false });
  });
});
