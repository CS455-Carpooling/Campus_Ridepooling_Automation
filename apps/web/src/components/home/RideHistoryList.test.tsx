import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RideHistoryList } from './RideHistoryList';

describe('RideHistoryList', () => {
  it('shows historical ride details and links to the full ride page', () => {
    render(
      <RideHistoryList
        rides={[
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
        ]}
      />,
    );

    const history = within(screen.getByRole('list', { name: 'Ride history' })).getByRole(
      'listitem',
    );
    expect(history).toHaveTextContent('Completed');
    expect(history).toHaveTextContent('Sat 3 Oct, 05:00 to 06:00');
    expect(history).toHaveTextContent('Rider');
    expect(history).toHaveTextContent('Pickup');
    expect(history).toHaveTextContent('Hall 3');
    expect(history).toHaveTextContent('Car');
    expect(history).toHaveTextContent('₹350');
    expect(history).toHaveTextContent('3 of 4');
    expect(within(history).getByRole('link', { name: 'View all ride details' })).toHaveAttribute(
      'href',
      '/rides/r4',
    );
  });

  it('explains when there is no history', () => {
    render(<RideHistoryList rides={[]} />);
    expect(screen.getByText(/past rides you offered or joined/)).toBeInTheDocument();
  });
});
