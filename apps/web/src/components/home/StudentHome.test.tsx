import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { StudentHomeData } from '@/lib/home-data';
import { StudentHome } from './StudentHome';

const empty: StudentHomeData = { upcoming: [], history: [], waiting: [] };

describe('StudentHome', () => {
  it('offers both ways to start: finding a ride and offering one', () => {
    render(<StudentHome data={empty} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Your rides' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a ride' })).toHaveAttribute('href', '/rides');
    expect(screen.getByRole('link', { name: 'Offer a ride' })).toHaveAttribute(
      'href',
      '/rides/new',
    );
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  });

  it('explains empty lists', () => {
    render(<StudentHome data={empty} />);
    expect(screen.getByText(/No upcoming rides/)).toBeInTheDocument();
    expect(screen.getByText('Nothing is waiting for a decision.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Upcoming rides' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Your rides' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Ride history' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('FR-RD-06.4: lists rides I offered and joined with IST departure, role and seats', () => {
    render(
      <StudentHome
        data={{
          upcoming: [
            {
              rideId: 'r1',
              title: 'To Kanpur Central',
              departure: '2026-10-02T23:30:00Z',
              part: 'rider',
              seatsLeft: 1,
              state: 'scheduled',
            },
            {
              rideId: 'r2',
              title: 'From Lucknow airport',
              departure: '2026-10-03T08:30:00Z',
              part: 'owner',
              seatsLeft: 0,
              state: 'pickup_in_progress',
            },
          ],
          history: [],
          waiting: [],
        }}
      />,
    );
    const rides = within(screen.getByRole('list', { name: 'Upcoming rides' })).getAllByRole(
      'listitem',
    );
    expect(rides).toHaveLength(2);
    expect(within(rides[0]).getByRole('link', { name: 'To Kanpur Central' })).toHaveAttribute(
      'href',
      '/rides/r1',
    );
    expect(rides[0]).toHaveTextContent('Sat 3 Oct, 05:00');
    expect(rides[0]).toHaveTextContent('Your part: Rider');
    expect(rides[0]).toHaveTextContent('1 seat left');
    expect(within(rides[0]).queryByText('Scheduled')).not.toBeInTheDocument();
    expect(rides[1]).toHaveTextContent('Your part: Owner');
    expect(rides[1]).toHaveTextContent('Full');
    expect(within(rides[1]).getByText('Pickup in progress')).toBeInTheDocument();
  });

  it('counts several free seats in the plural', () => {
    render(
      <StudentHome
        data={{
          upcoming: [
            {
              rideId: 'r3',
              title: 'To Bus stand',
              departure: '2026-10-03T08:30:00Z',
              part: 'owner',
              seatsLeft: 3,
              state: 'scheduled',
            },
          ],
          history: [],
          waiting: [],
        }}
      />,
    );
    expect(screen.getByText('3 seats left')).toBeInTheDocument();
  });

  it('describes requests sent and received', () => {
    render(
      <StudentHome
        data={{
          upcoming: [],
          history: [],
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
    const items = within(screen.getByRole('list', { name: 'Waiting requests' })).getAllByRole(
      'listitem',
    );
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

  it('switches between tabs in place without navigating away', async () => {
    const user = userEvent.setup();
    render(
      <StudentHome
        data={{
          ...empty,
          history: [
            {
              rideId: 'r4',
              title: 'To Kanpur Central',
              departureStart: '2026-10-02T23:30:00Z',
              departureEnd: '2026-10-03T00:30:00Z',
              part: 'rider',
              campusPlace: 'Hall 3',
              direction: 'to_hub',
              vehicleName: 'Car',
              totalFare: 350,
              capacity: 4,
              occupantCount: 3,
              state: 'completed',
            },
          ],
        }}
      />,
    );
    const historyTab = screen.getByRole('tab', { name: 'Ride history' });

    await user.click(historyTab);

    expect(historyTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Ride history' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Ride history' })).toBeVisible();
    expect(document.getElementById('upcoming-panel')).toHaveAttribute('hidden');
    expect(screen.getByText('To Kanpur Central')).toBeVisible();
    expect(window.location.pathname).toBe('/');
  });

  it('supports arrow-key navigation between tabs', () => {
    render(<StudentHome data={empty} />);
    const upcomingTab = screen.getByRole('tab', { name: 'Your rides' });

    fireEvent.keyDown(upcomingTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Ride history' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Ride history' })).toHaveFocus();
  });
});
