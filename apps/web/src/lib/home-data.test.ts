import { describe, expect, it } from 'vitest';
import { getAdminHome, getStudentHome } from './home-data';

describe('home data (until the rides and admin APIs exist)', () => {
  it('gives a student empty lists', async () => {
    await expect(getStudentHome('u1')).resolves.toEqual({ upcoming: [], waiting: [] });
  });

  it('marks every admin count as not available rather than zero', async () => {
    await expect(getAdminHome()).resolves.toEqual({
      openIncidents: null,
      complaintsToReview: null,
      recommendationsToDecide: null,
    });
  });
});
