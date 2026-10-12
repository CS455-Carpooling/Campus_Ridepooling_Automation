import { describe, expect, it } from 'vitest';
import { parseSearchRequest } from './ride-search-rules';

const valid = {
  direction: 'to_hub',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-6',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
};

describe('parseSearchRequest', () => {
  it('accepts the filters the search form sends', () => {
    expect(parseSearchRequest({ ...valid, vehicleTypeId: 'auto', maxFareShare: '150' })).toEqual({
      ...valid,
      vehicleTypeId: 'auto',
      maxFareShare: 150,
    });
  });

  it('leaves out the optional filters when they are not given', () => {
    expect(parseSearchRequest(valid)).toEqual({
      ...valid,
      vehicleTypeId: undefined,
      maxFareShare: undefined,
    });
  });

  it.each(['direction', 'hubId', 'campusLocationId', 'departureStart', 'departureEnd'])(
    'refuses a search without %s',
    (field) => {
      expect(parseSearchRequest({ ...valid, [field]: '' })).toBeNull();
      expect(parseSearchRequest({ ...valid, [field]: undefined })).toBeNull();
    },
  );

  it('refuses an unknown direction and a repeated parameter', () => {
    expect(parseSearchRequest({ ...valid, direction: 'sideways' })).toBeNull();
    expect(parseSearchRequest({ ...valid, hubId: ['kanpur-central', 'lucknow'] })).toBeNull();
  });

  it.each([
    ['a date that does not exist', '2026-13-45T06:30:00+05:30'],
    ['31 November', '2099-11-31T06:30:00+05:30'],
    ['no offset', '2099-10-10T06:30:00'],
    ['an offset beyond +14:00', '2099-10-10T06:30:00+15:00'],
    ['text', 'tomorrow morning'],
  ])('refuses %s, which the database would reject', (_, time) => {
    expect(parseSearchRequest({ ...valid, departureStart: time })).toBeNull();
  });

  it('refuses a window that ends before it starts, or ends when it starts', () => {
    expect(parseSearchRequest({ ...valid, departureEnd: valid.departureStart })).toBeNull();
    expect(parseSearchRequest({ ...valid, departureEnd: '2099-10-10T06:00:00+05:30' })).toBeNull();
  });

  it.each(['0', '-50', '12.5', 'abc', '50001', '99999999999'])(
    'refuses a maximum share of %s',
    (amount) => {
      expect(parseSearchRequest({ ...valid, maxFareShare: amount })).toBeNull();
    },
  );
});
