import { describe, expect, it } from 'vitest';
import { roleLabels } from './roles';
import { currentHref, navigationFor, routes } from './routes';

describe('navigationFor', () => {
  it('gives students the rider and ride-owner entry points', () => {
    expect(navigationFor('student').map((item) => item.label)).toEqual([
      'Home',
      'Profile',
      'Find a ride',
      'Offer a ride',
      'Notifications',
    ]);
  });

  it('gives operations admins their queues and configuration', () => {
    expect(navigationFor('admin').map((item) => item.label)).toEqual([
      'Home',
      'Profile',
      'Incidents',
      'Complaints',
      'Configuration',
    ]);
  });

  it('only links to paths inside the app', () => {
    for (const role of Object.keys(roleLabels) as Array<keyof typeof roleLabels>) {
      for (const item of navigationFor(role)) expect(item.href).toMatch(/^\/[a-z/-]*$/);
    }
  });
});

describe('routes.ride', () => {
  it('encodes the ride id', () => {
    expect(routes.ride('abc 1/2')).toBe('/rides/abc%201%2F2');
  });
});

describe('routes.rideReview', () => {
  it('is the review page under the ride, with the id encoded', () => {
    expect(routes.rideReview('abc 1/2')).toBe('/rides/abc%201%2F2/review');
  });
});

describe('currentHref', () => {
  const items = navigationFor('student');

  it('matches the page itself', () => {
    expect(currentHref('/dashboard', items)).toBe('/dashboard');
    expect(currentHref('/profile', items)).toBe('/profile');
    expect(currentHref('/rides', items)).toBe('/rides');
  });

  it('prefers the most specific entry', () => {
    expect(currentHref('/rides/new', items)).toBe('/rides/new');
    expect(currentHref('/rides/r-42', items)).toBe('/rides');
  });

  it('matches nothing for unrelated or missing paths', () => {
    expect(currentHref('/ridesharing', items)).toBeUndefined();
    expect(currentHref('/', items)).toBeUndefined();
    expect(currentHref(null, items)).toBeUndefined();
  });
});
