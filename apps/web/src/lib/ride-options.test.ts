import { describe, expect, it } from 'vitest';
import { getRideFormOptions } from './ride-options';

describe('getRideFormOptions (fixed lists until CS455-22)', () => {
  it('offers Hall 1 to Hall 14 and Main Gate on campus', async () => {
    const { campusPlaces } = await getRideFormOptions();
    expect(campusPlaces).toHaveLength(15);
    expect(campusPlaces[0]).toEqual({ id: 'hall-1', name: 'Hall 1' });
    expect(campusPlaces.at(-2)).toEqual({ id: 'hall-14', name: 'Hall 14' });
    expect(campusPlaces.at(-1)).toEqual({ id: 'main-gate', name: 'Main Gate' });
  });

  it('offers the six SYS-FR-09 transport hubs, metro station included', async () => {
    const { hubs } = await getRideFormOptions();
    expect(hubs.map((hub) => hub.name)).toEqual([
      'Kanpur Central',
      'Kanpur Anwarganj',
      'Bus stand',
      'Metro station',
      'Kanpur airport',
      'Lucknow airport',
    ]);
  });

  it('offers car, auto and Vikram, with capacities counting the owner', async () => {
    const { vehicleTypes } = await getRideFormOptions();
    expect(vehicleTypes.map(({ name, capacity }) => [name, capacity])).toEqual([
      ['Car', 4],
      ['Auto', 3],
      ['Vikram', 7],
    ]);
  });

  it('uses unique lower-case text codes as ids, like the database seed', async () => {
    const { campusPlaces, hubs, vehicleTypes } = await getRideFormOptions();
    const ids = [...campusPlaces, ...hubs, ...vehicleTypes].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
