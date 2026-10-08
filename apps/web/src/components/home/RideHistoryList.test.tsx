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
            completedAt: '2026-10-03T01:00:00.000Z',
            ratingsGiven: 0,
            ratingClosesAt: '2026-10-06T01:00:00.000Z',
            canRate: false,
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

describe('RideHistoryList: ratings given (CS455-44, FR-RD-16.1)', () => {
  const ride = {
    rideId: 'r5',
    title: 'To Kanpur Central',
    departureStart: '2026-10-10T01:00:00Z',
    departureEnd: '2026-10-10T02:00:00Z',
    part: 'rider' as const,
    campusPlace: 'Hall 3',
    direction: 'to_hub' as const,
    vehicleName: 'Car',
    totalFare: 350,
    capacity: 4,
    occupantCount: 3,
    state: 'completed' as const,
    completedAt: '2026-10-10T02:35:00.000Z',
    ratingsGiven: 1,
    ratingClosesAt: '2026-10-13T02:35:00.000Z',
    canRate: true,
  };

  it('says how many of the others the viewer rated, and links to rating while it is open', () => {
    render(<RideHistoryList rides={[ride]} />);
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('Ratings given').nextSibling).toHaveTextContent('1 of 2');
    expect(
      within(item).getByRole('link', { name: 'Rate the people on this ride' }),
    ).toHaveAttribute('href', '/rides/r5/review');
  });

  it('drops the link once rating is over, and the count on rides that were not completed', () => {
    const { rerender } = render(
      <RideHistoryList rides={[{ ...ride, ratingsGiven: 2, canRate: false }]} />,
    );
    expect(screen.getByText('Ratings given').nextSibling).toHaveTextContent('2 of 2');
    expect(screen.queryByRole('link', { name: 'Rate the people on this ride' })).toBeNull();
    rerender(
      <RideHistoryList
        rides={[
          { ...ride, state: 'cancelled', completedAt: null, ratingClosesAt: null, canRate: false },
        ]}
      />,
    );
    expect(screen.queryByText('Ratings given')).toBeNull();
  });
});
