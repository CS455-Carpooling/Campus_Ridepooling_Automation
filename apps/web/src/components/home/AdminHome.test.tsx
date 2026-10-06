import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminHome } from './AdminHome';

describe('AdminHome', () => {
  it('says a queue is not available yet instead of showing a false zero', () => {
    render(
      <AdminHome
        data={{ openIncidents: null, complaintsToReview: null, recommendationsToDecide: null }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getAllByText('Not available yet')).toHaveLength(3);
  });

  it('shows the open count of each queue with a link to it', () => {
    render(
      <AdminHome data={{ openIncidents: 2, complaintsToReview: 0, recommendationsToDecide: 5 }} />,
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getByRole('link', { name: 'SOS incidents' })).toHaveAttribute(
      'href',
      '/admin/incidents',
    );
    expect(within(rows[1]).getByText('2')).toBeInTheDocument();
    expect(within(rows[2]).getByText('0')).toBeInTheDocument();
    expect(
      within(rows[3]).getByRole('link', { name: 'AI recommendations awaiting your decision' }),
    ).toHaveAttribute('href', '/admin/recommendations');
    expect(screen.queryByText('Not available yet')).not.toBeInTheDocument();
  });

  it('links to the configuration pages', () => {
    render(
      <AdminHome
        data={{ openIncidents: null, complaintsToReview: null, recommendationsToDecide: null }}
      />,
    );
    const configuration = screen.getByRole('region', { name: 'Configuration' });
    expect(
      within(configuration).getByRole('link', { name: 'Vehicle types and seat capacity' }),
    ).toHaveAttribute('href', '/admin/configuration/vehicle-types');
    expect(within(configuration).getAllByRole('link')).toHaveLength(3);
  });
});
