import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StudentHomeData } from '@/lib/home-data';
import { StudentHome } from './StudentHome';

const empty: StudentHomeData = { upcoming: [], waiting: [] };

describe('StudentHome', () => {
  it('offers both ways to start: finding a ride and offering one', () => {
    render(<StudentHome data={empty} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Your rides' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a ride' })).toHaveAttribute('href', '/rides');
    expect(screen.getByRole('link', { name: 'Offer a ride' })).toHaveAttribute(
      'href',
      '/rides/new',
    );
  });

  it('explains empty lists', () => {
    render(<StudentHome data={empty} />);
    expect(screen.getByText(/No upcoming rides/)).toBeInTheDocument();
    expect(screen.getByText('Nothing is waiting for a decision.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('lists upcoming rides with IST departure, role and seats', () => {
    render(
      <StudentHome
        data={{
          upcoming: [
            {
              rideId: 'r1',
              destination: 'Kanpur Central',
              departure: '2026-10-02T23:30:00Z',
              part: 'rider',
              seatsLeft: 1,
            },
            {
              rideId: 'r2',
              destination: 'Lucknow airport',
              departure: '2026-10-03T08:30:00Z',
              part: 'owner',
              seatsLeft: 3,
            },
          ],
          waiting: [],
        }}
      />,
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('Sat 3 Oct, 05:00')).toBeInTheDocument();
    expect(within(rows[1]).getByRole('link', { name: 'Kanpur Central' })).toHaveAttribute(
      'href',
      '/rides/r1',
    );
    expect(within(rows[1]).getByText('Rider')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Owner')).toBeInTheDocument();
    expect(within(rows[2]).getByText('3')).toBeInTheDocument();
  });

  it('describes requests sent and received', () => {
    render(
      <StudentHome
        data={{
          upcoming: [],
          waiting: [
            {
              kind: 'sent',
              requestId: 'q1',
              rideId: 'r1',
              destination: 'Kanpur Central',
              departure: '2026-10-02T23:30:00Z',
            },
            {
              kind: 'received',
              requestId: 'q2',
              rideId: 'r2',
              destination: 'Lucknow airport',
              departure: '2026-10-03T08:30:00Z',
              riderName: 'Rohan',
            },
          ],
        }}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(
      'Your request for the ride to Kanpur Central on Sat 3 Oct, 05:00 is waiting for the ride owner.',
    );
    expect(items[1]).toHaveTextContent(
      'Rohan asked to join your ride to Lucknow airport on Sat 3 Oct, 14:00.',
    );
    expect(within(items[1]).getByRole('link', { name: 'Lucknow airport' })).toHaveAttribute(
      'href',
      '/rides/r2',
    );
  });
});
