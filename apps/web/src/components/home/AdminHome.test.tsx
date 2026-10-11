import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminActivity, AdminHomeData } from '@/lib/home-data';
import { AdminHome } from './AdminHome';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

const empty: AdminHomeData = {
  openIncidents: null,
  complaintsToReview: 0,
  safetyComplaintsToReview: 0,
  recommendationsToDecide: 0,
  ridersSuspended: 0,
  recentActions: [],
};

const entry = (change: Partial<AdminActivity>): AdminActivity => ({
  id: 'e1',
  action: 'rider.warn',
  actor: 'admin',
  adminName: 'Ops Admin',
  subject: 'Aditi Rao',
  outcome: 'succeeded',
  at: '2026-10-11T04:21:00+05:30',
  ...change,
});

describe('AdminHome (CS455-49)', () => {
  it('sits in the admin shell, with Home marked as the current page', () => {
    render(<AdminHome data={empty} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Operations admin' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  });

  it('shows the real count of each queue with a link to it', () => {
    render(
      <AdminHome
        data={{
          ...empty,
          complaintsToReview: 4,
          safetyComplaintsToReview: 1,
          recommendationsToDecide: 2,
          ridersSuspended: 3,
        }}
      />,
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(
      within(rows[1]).getByRole('link', { name: 'Complaints awaiting review' }),
    ).toHaveAttribute('href', '/admin/complaints');
    expect(within(rows[1]).getByText('4')).toBeInTheDocument();
    expect(within(rows[1]).getByText('1 about safety')).toBeInTheDocument();
    expect(
      within(rows[2]).getByRole('link', { name: 'AI recommendations awaiting your decision' }),
    ).toHaveAttribute('href', '/admin/complaints');
    expect(within(rows[2]).getByText('2')).toBeInTheDocument();
    expect(within(rows[3]).getByRole('link', { name: 'Riders suspended now' })).toHaveAttribute(
      'href',
      '/admin/riders',
    );
    expect(within(rows[3]).getByText('3')).toBeInTheDocument();
  });

  it('shows a true zero, and says SOS is not available yet without linking to it', () => {
    render(<AdminHome data={empty} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getByText('0')).toBeInTheDocument();
    expect(within(rows[1]).queryByText(/about safety/)).not.toBeInTheDocument();
    expect(within(rows[4]).getByText('SOS incidents')).toBeInTheDocument();
    expect(within(rows[4]).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getAllByText('Not available yet')).toHaveLength(1);
  });

  it('lists recent admin actions with who, when and the outcome (SYS-NFR-12)', () => {
    render(
      <AdminHome
        data={{
          ...empty,
          recentActions: [
            entry({}),
            entry({ id: 'e2', action: 'vehicle_type.update', subject: 'Auto', outcome: 'refused' }),
            entry({ id: 'e3', action: 'rider.suspend', subject: null, outcome: 'failed' }),
            entry({ id: 'e4', action: 'role.grant', actor: 'operator_script', adminName: null }),
          ],
        }}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Recent admin actions' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Warned a rider: Aditi Rao');
    expect(items[0]).toHaveTextContent('Ops Admin, Sun 11 Oct, 04:21');
    expect(within(items[0]).getByText('Done')).toBeInTheDocument();
    expect(within(items[1]).getByText('Refused')).toBeInTheDocument();
    expect(items[2]).toHaveTextContent(/^Suspended a rider(?!:)/);
    expect(within(items[2]).getByText('Failed')).toBeInTheDocument();
    expect(items[3]).toHaveTextContent('Operator script');
    expect(within(items[0]).getByText('Sun 11 Oct, 04:21')).toHaveAttribute(
      'dateTime',
      '2026-10-11T04:21:00+05:30',
    );
  });

  it('says when no admin has acted yet', () => {
    render(<AdminHome data={empty} />);
    expect(screen.getByText(/No admin actions yet/)).toBeInTheDocument();
  });

  it('links to the configuration pages', () => {
    render(<AdminHome data={empty} />);
    const configuration = screen.getByRole('region', { name: 'Configuration' });
    expect(
      within(configuration).getByRole('link', { name: 'Vehicle types and seat capacity' }),
    ).toHaveAttribute('href', '/admin/configuration/vehicle-types');
    expect(within(configuration).getAllByRole('link')).toHaveLength(3);
  });
});
