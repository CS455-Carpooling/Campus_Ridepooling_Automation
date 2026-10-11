import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigurationData } from '@/lib/admin-config-queries';

const h = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  getConfiguration: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: h.requireAdminPage }));
vi.mock('@/lib/admin-config-queries', () => ({ getConfiguration: h.getConfiguration }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/configuration',
  useRouter: () => ({ push: vi.fn() }),
}));

import FaresPage from './fares/page';
import HubsPage from './hubs/page';
import ConfigurationPage from './page';
import VehicleTypesPage from './vehicle-types/page';

const data: ConfigurationData = {
  vehicleTypes: [
    { id: 'auto', name: 'Auto', capacity: 3, isActive: true, sortOrder: 1, version: 1 },
    { id: 'car', name: 'Car', capacity: 4, isActive: true, sortOrder: 2, version: 1 },
    { id: 'jet', name: 'Jet', capacity: 9, isActive: false, sortOrder: 3, version: 1 },
  ],
  hubs: [
    {
      id: 'kanpur-central',
      type: 'transport_hub',
      name: 'Kanpur Central',
      detail: 'Railway station',
      isActive: true,
      sortOrder: 1,
      version: 1,
    },
  ],
  campusPlaces: [
    {
      id: 'hall-1',
      type: 'campus',
      name: 'Hall 1',
      detail: null,
      isActive: true,
      sortOrder: 1,
      version: 1,
    },
  ],
  campusFares: [],
  externalFareRanges: [
    {
      hubId: 'kanpur-central',
      vehicleTypeId: 'auto',
      minFare: 250,
      maxFare: 400,
      version: 1,
      updatedAt: '2026-10-11T10:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
  h.getConfiguration.mockResolvedValue(data);
});

describe('configuration pages (CS455-51)', () => {
  it.each([
    ['/admin/configuration', ConfigurationPage],
    ['/admin/configuration/vehicle-types', VehicleTypesPage],
    ['/admin/configuration/hubs', HubsPage],
    ['/admin/configuration/fares', FaresPage],
  ])(
    '%s shows a student the "not for you" page, without reading the configuration',
    async (_, Page) => {
      h.requireAdminPage.mockResolvedValue(null);
      render(await Page());
      expect(
        screen.getByRole('heading', { level: 1, name: 'This page is for operations admins' }),
      ).toBeInTheDocument();
      expect(h.getConfiguration).not.toHaveBeenCalled();
    },
  );

  it('the overview links to each section with how much is set up', async () => {
    render(await ConfigurationPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Configuration' })).toBeInTheDocument();
    const vehicles = screen
      .getByRole('link', { name: 'Vehicle types' })
      .closest('li') as HTMLElement;
    expect(vehicles).toHaveTextContent('2 active types');
    expect(vehicles).toHaveTextContent('1 inactive');
    expect(screen.getByRole('link', { name: 'Hubs and pickup points' })).toHaveAttribute(
      'href',
      '/admin/configuration/hubs',
    );
    const fares = screen.getByRole('link', { name: 'Fares' }).closest('li') as HTMLElement;
    expect(fares).toHaveTextContent('1 of 2 hub ranges set');
    expect(fares).toHaveTextContent('0 campus fares');
  });

  it('the vehicle types page edits the list, with a way back', async () => {
    render(await VehicleTypesPage());
    expect(screen.getByRole('link', { name: 'Back to configuration' })).toHaveAttribute(
      'href',
      '/admin/configuration',
    );
    expect(
      within(screen.getByRole('list', { name: 'All vehicle types' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('the hubs page edits transport hubs and campus pickup points', async () => {
    render(await HubsPage());
    expect(screen.getByRole('heading', { level: 2, name: 'Transport hubs' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Campus pickup points' }),
    ).toBeInTheDocument();
  });

  it('the fares page edits hub ranges and campus fares', async () => {
    render(await FaresPage());
    expect(screen.getByRole('form', { name: 'Auto from Kanpur Central' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Set a campus fare' })).toBeInTheDocument();
  });
});
