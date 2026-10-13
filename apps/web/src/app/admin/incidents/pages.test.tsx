import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  listIncidents: vi.fn(),
  getIncident: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/admin/incidents',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock('@/lib/admin-incident-queries', () => ({
  listIncidents: mocks.listIncidents,
  getIncident: mocks.getIncident,
}));

import AdminIncidentPage from './[id]/page';
import AdminIncidentsPage from './page';

const ID = 'a5a5a5a5-5555-4000-8000-000000000001';
const base = {
  id: ID,
  reference: 'SOS-1A2B3C4D',
  status: 'open',
  raisedAt: '2026-10-13T12:40:00.000Z',
  raiserName: 'Kabir Shah',
  raisedRole: 'rider',
  rideTitle: 'To Kanpur Central',
  falseAlarm: false,
  locationShared: true,
};
const detail = {
  ...base,
  rideId: 'r1',
  raiserId: 'u2',
  tripState: 'in_transit',
  mobileNumber: '9876500001',
  location: {
    latitude: 26.5123,
    longitude: 80.2329,
    accuracyM: 14,
    at: '2026-10-13T12:40:30.000Z',
  },
  falseAlarmAt: null,
  context: {
    ride: {
      title: 'To Kanpur Central',
      direction: 'to_hub',
      hub: 'Kanpur Central',
      departureStart: '2026-10-13T12:30:00.000Z',
      departureEnd: '2026-10-13T13:30:00.000Z',
      vehicle: 'Car',
      state: 'in_transit',
    },
    occupants: [
      {
        userId: 'u1',
        name: 'Ananya Rao',
        role: 'owner',
        place: 'Hall 1',
        status: 'waiting',
        raisedTheAlert: false,
      },
      {
        userId: 'u2',
        name: 'Kabir Shah',
        role: 'rider',
        place: 'Hall 2',
        status: 'arrived',
        raisedTheAlert: true,
      },
    ],
  },
  acknowledged: null,
  closed: null,
};

const openDetail = (id = ID) =>
  AdminIncidentPage({ params: Promise.resolve({ id }) } as PageProps<'/admin/incidents/[id]'>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ unacknowledged: 0, newest: null })),
  );
  mocks.requireAdminPage.mockResolvedValue({ userId: 'a1', role: 'admin' });
  mocks.listIncidents.mockResolvedValue([base]);
  mocks.getIncident.mockResolvedValue(detail);
});

describe('/admin/incidents (CS455-65)', () => {
  it('lists the alerts with their status, raiser and location', async () => {
    render(await AdminIncidentsPage());
    expect(screen.getByRole('heading', { level: 1, name: 'SOS incidents' })).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'SOS incidents' })).getAllByRole(
      'listitem',
    );
    expect(within(items[0]).getByRole('link', { name: 'SOS-1A2B3C4D' })).toHaveAttribute(
      'href',
      `/admin/incidents/${ID}`,
    );
    expect(items[0]).toHaveTextContent('Raised by Kabir Shah (rider)');
    expect(items[0]).toHaveTextContent('Location shared.');
    expect(within(items[0]).getByText('Open')).toBeInTheDocument();
  });

  it('marks false alarms, says when there are none, and turns students away', async () => {
    mocks.listIncidents.mockResolvedValueOnce([
      { ...base, falseAlarm: true, locationShared: false },
    ]);
    render(await AdminIncidentsPage());
    expect(screen.getByText('Marked a false alarm')).toBeInTheDocument();
    expect(screen.getByText(/No location\./)).toBeInTheDocument();

    mocks.listIncidents.mockResolvedValueOnce([]);
    render(await AdminIncidentsPage());
    expect(screen.getByText('No SOS alerts have been raised.')).toBeInTheDocument();

    mocks.requireAdminPage.mockResolvedValueOnce(null);
    render(await AdminIncidentsPage());
    expect(mocks.listIncidents).toHaveBeenCalledTimes(2);
  });
});

describe('/admin/incidents/[id] (CS455-65)', () => {
  it('shows the trip as it was, the mobile number and the location, with the actions', async () => {
    render(await openDetail());
    expect(screen.getByRole('heading', { level: 1, name: 'SOS-1A2B3C4D' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '9876500001' })).toHaveAttribute(
      'href',
      'tel:9876500001',
    );
    expect(screen.getByRole('link', { name: '26.51230, 80.23290' })).toHaveAttribute(
      'href',
      expect.stringContaining('openstreetmap.org/?mlat=26.5123&mlon=80.2329'),
    );
    expect(screen.getByText(/Within about 14 m/)).toBeInTheDocument();
    const people = within(
      screen.getByRole('list', { name: 'On the ride when it was raised' }),
    ).getAllByRole('listitem');
    expect(people[1]).toHaveTextContent('Kabir Shah raised the alert');
    expect(people[1]).toHaveTextContent('Rider, Hall 2, arrived');
    expect(within(people[0]).getByRole('link', { name: 'Ananya Rao' })).toHaveAttribute(
      'href',
      '/admin/riders/u1',
    );
    expect(screen.getByRole('link', { name: 'To Kanpur Central' })).toHaveAttribute(
      'href',
      '/admin/rides/r1',
    );
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
  });

  it('shows who handled a closed alert, a false alarm, and no mobile or location', async () => {
    mocks.getIncident.mockResolvedValueOnce({
      ...detail,
      status: 'closed',
      mobileNumber: null,
      location: null,
      falseAlarmAt: '2026-10-13T12:41:00.000Z',
      acknowledged: { at: '2026-10-13T12:42:00.000Z', by: 'Ops Admin' },
      closed: { at: '2026-10-13T12:50:00.000Z', by: 'Ops Admin', note: 'Called the rider; safe.' },
    });
    render(await openDetail());
    expect(screen.getByText(/marked it a false alarm/)).toBeInTheDocument();
    expect(screen.getByText('Not given')).toBeInTheDocument();
    expect(screen.getByText('Not shared')).toBeInTheDocument();
    expect(screen.getByText(/Acknowledged by Ops Admin/)).toBeInTheDocument();
    expect(screen.getByText('Called the rider; safe.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  it('is not found for an unknown alert, and not for students', async () => {
    mocks.getIncident.mockResolvedValueOnce(null);
    await expect(openDetail('x')).rejects.toThrow('NEXT_NOT_FOUND');
    mocks.requireAdminPage.mockResolvedValueOnce(null);
    render(await openDetail());
    expect(mocks.getIncident).toHaveBeenCalledTimes(1);
  });
});
