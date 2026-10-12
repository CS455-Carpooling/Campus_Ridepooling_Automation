import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RideOccupant, RideView } from '@/lib/ride-view';
import { RideDetails } from './RideDetails';
import { tripView } from './trip-test-data';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const owner: RideOccupant = {
  occupantId: '6f1c2a5e-3333-4000-8000-000000000001',
  name: 'Ananya Rao',
  campusPlace: 'Hall 6',
  isOwner: true,
  isViewer: false,
  visibleTags: ['Quiet ride'],
  completedTrips: 3,
  share: 175,
  rating: null,
  status: 'waiting',
  noShowAvailableAt: null,
};
const rider: RideOccupant = {
  occupantId: '6f1c2a5e-3333-4000-8000-000000000002',
  name: 'Kabir Shah',
  campusPlace: 'Hall 3',
  isOwner: false,
  isViewer: false,
  visibleTags: [],
  completedTrips: 1,
  share: 175,
  rating: null,
  status: 'waiting',
  noShowAvailableAt: null,
};

// Leaves campus 06:30 to 07:30 IST on Saturday 10 October 2026; read at 21:12:05 IST the night before.
function rideView(change: Partial<RideView> = {}): RideView {
  return {
    id: '0b9a7c1e-1111-4000-8000-000000000001',
    direction: 'to_hub',
    hubId: 'kanpur-central',
    hub: { name: 'Kanpur Central', detail: 'Railway station' },
    departureStart: '2026-10-10T01:00:00.000Z',
    departureEnd: '2026-10-10T02:00:00.000Z',
    lockAt: '2026-10-10T00:00:00.000Z',
    state: 'scheduled',
    isLocked: false,
    isOpen: true,
    windowEnded: false,
    completedAt: null,
    canComplete: false,
    trip: null,
    canComplain: false,
    review: null,
    vehicleName: 'Car',
    capacity: 4,
    occupantCount: 2,
    seatsLeft: 2,
    totalFare: 350,
    occupants: [owner, rider],
    viewerRole: 'visitor',
    viewerShare: null,
    estimatedShare: 117,
    readAt: '2026-10-09T15:42:05.000Z',
    ...change,
  };
}

describe('RideDetails', () => {
  it('names the ride, its window, state and lock time', () => {
    render(<RideDetails ride={rideView()} />);
    expect(screen.getByText('Leaving campus')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'To Kanpur Central' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Railway station')).toBeInTheDocument();
    expect(screen.getByText('Sat 10 Oct, 06:30 to 07:30')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(
      screen.getByText('Locks Sat 10 Oct, 05:30, an hour before departure'),
    ).toBeInTheDocument();
  });

  it('FR-RD-08.1: shows a visitor an estimated share, labelled as an estimate', () => {
    render(<RideDetails ride={rideView()} />);
    const panel = screen.getByRole('region', { name: 'Estimated share if you join' });
    expect(panel).toHaveTextContent('₹117');
    expect(panel).toHaveTextContent('An estimate: the total fare split between 3 people');
  });

  it('UC-RO-04: shows capacity, seats taken and free, and the total fare', () => {
    render(<RideDetails ride={rideView()} />);
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('Capacity').nextSibling).toHaveTextContent('4 people, owner included');
    expect(screen.getByText('Seats').nextSibling).toHaveTextContent('2 taken, 2 free');
    expect(screen.getByText('Total fare').nextSibling).toHaveTextContent('₹350');
  });

  it('FR-RD-03.6: lists everyone with their role, campus place and share, owner first', () => {
    render(<RideDetails ride={rideView()} />);
    const people = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(people[0]).toHaveTextContent('Ananya Rao');
    expect(people[0]).toHaveTextContent('Owner, pickup at Hall 6');
    expect(people[0]).toHaveTextContent('3 completed trips');
    expect(people[0]).toHaveTextContent('Quiet ride');
    expect(people[0]).toHaveTextContent('Share ₹175');
    expect(people[1]).toHaveTextContent('Kabir Shah');
    expect(people[1]).toHaveTextContent('Rider, pickup at Hall 3');
  });

  it("shows the owner their own share and marks them as 'you'", () => {
    render(
      <RideDetails
        ride={rideView({
          viewerRole: 'owner',
          viewerShare: 350,
          estimatedShare: null,
          occupantCount: 1,
          seatsLeft: 3,
          occupants: [{ ...owner, isViewer: true, share: 350 }],
        })}
      />,
    );
    expect(screen.getByRole('region', { name: 'Your share' })).toHaveTextContent('₹350');
    expect(screen.getByText('(you)')).toBeInTheDocument();
    expect(screen.queryByText(/Estimated share/)).not.toBeInTheDocument();
  });

  it('tells a rider on a locked ride that their share is fixed', () => {
    render(
      <RideDetails
        ride={rideView({
          viewerRole: 'rider',
          viewerShare: 175,
          estimatedShare: null,
          isLocked: true,
          isOpen: false,
          occupants: [owner, { ...rider, isViewer: true }],
        })}
      />,
    );
    expect(screen.getByRole('region', { name: 'Your share' })).toHaveTextContent(
      'The ride is locked: this share changes only if someone is marked a no-show',
    );
    expect(screen.getByText(/Locked since Sat 10 Oct, 05:30/)).toBeInTheDocument();
  });

  it('tells a visitor when the ride is full', () => {
    render(<RideDetails ride={rideView({ capacity: 2, seatsLeft: 0, estimatedShare: null })} />);
    expect(screen.getByRole('region', { name: 'This ride is full' })).toHaveTextContent(
      'Every seat is taken.',
    );
  });

  it('hides shares on a cancelled ride and labels it Cancelled', () => {
    render(
      <RideDetails
        ride={rideView({
          state: 'cancelled',
          viewerRole: 'owner',
          viewerShare: 175,
          isOpen: false,
        })}
      />,
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /share|full/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Share ₹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Locks/)).not.toBeInTheDocument();
  });

  it('says when the departure window has passed', () => {
    render(
      <RideDetails
        ride={rideView({ viewerRole: 'owner', isLocked: true, isOpen: false, windowEnded: true })}
      />,
    );
    expect(screen.getByText('Departure window ended Sat 10 Oct, 07:30')).toBeInTheDocument();
  });

  it('words a ride to campus from the hub, with drop-off places', () => {
    render(<RideDetails ride={rideView({ direction: 'from_hub' })} />);
    expect(screen.getByText('Coming to campus')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'From Kanpur Central' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Owner, drop-off at Hall 6/)).toBeInTheDocument();
  });

  it('explains the extra rupee when the fare does not split evenly (Table T-2)', () => {
    render(
      <RideDetails
        ride={rideView({
          occupantCount: 3,
          occupants: [
            { ...owner, share: 117 },
            { ...rider, share: 117 },
            { ...rider, name: 'Meera Iyer', share: 116 },
          ],
        })}
      />,
    );
    expect(screen.getByText(/the first 2 people pay one rupee more/)).toBeInTheDocument();
  });

  it('copes with a ride nobody is on yet', () => {
    render(
      <RideDetails ride={rideView({ occupants: [], occupantCount: 0, estimatedShare: 350 })} />,
    );
    expect(screen.getByText('Nobody is on this ride yet.')).toBeInTheDocument();
  });

  it('FR-RD-03.3: says when the seats were read, offers a refresh and links back', () => {
    render(<RideDetails ride={rideView()} />);
    expect(screen.getByText('21:12:05')).toHaveAttribute('datetime', '2026-10-09T15:42:05.000Z');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your rides' })).toHaveAttribute('href', '/dashboard');
  });
});

describe('RideDetails: completing a ride (FR-RO-09.4)', () => {
  it('gives the owner the trip controls from the lock, and Complete once the trip started (CS455-63)', () => {
    const { rerender } = render(
      <RideDetails
        ride={rideView({ viewerRole: 'owner', trip: tripView({ canStartPickup: true }) })}
      />,
    );
    // Before the lock there is no trip to run yet.
    expect(screen.queryByRole('heading', { name: 'Run the trip' })).not.toBeInTheDocument();
    rerender(
      <RideDetails
        ride={rideView({
          viewerRole: 'owner',
          isLocked: true,
          isOpen: false,
          trip: tripView({ canStartPickup: true }),
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Run the trip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start pickup' })).toBeInTheDocument();
    rerender(
      <RideDetails
        ride={rideView({
          viewerRole: 'owner',
          state: 'pickup_in_progress',
          isLocked: true,
          isOpen: false,
          canComplete: true,
          trip: tripView({ pickupStartedAt: '2026-10-10T00:50:00.000Z' }),
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Complete the ride' })).toBeInTheDocument();
    expect(screen.getByText('Pickup started Sat 10 Oct, 06:20')).toBeInTheDocument();
  });

  it('lets a rider follow the trip, says when it is on its way, and marks a no-show', () => {
    render(
      <RideDetails
        ride={rideView({
          viewerRole: 'rider',
          state: 'in_transit',
          isLocked: true,
          isOpen: false,
          trip: tripView({ tripStartedAt: '2026-10-10T01:10:00.000Z' }),
          occupants: [owner, { ...rider, isViewer: true, share: null, status: 'no_show' }],
          viewerShare: null,
          estimatedShare: null,
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your trip' })).toBeInTheDocument();
    expect(screen.getByText('On the way since Sat 10 Oct, 06:40')).toBeInTheDocument();
    const people = within(screen.getByRole('region', { name: 'People on this ride' })).getAllByRole(
      'listitem',
    );
    expect(people[1]).toHaveTextContent('No-show');
    expect(people[1]).toHaveTextContent('No share');
  });

  it('offers SOS to someone on the ride while the trip is under way (CS455-64)', () => {
    const { rerender } = render(
      <RideDetails
        ride={rideView({
          viewerRole: 'rider',
          state: 'in_transit',
          isLocked: true,
          isOpen: false,
          trip: tripView({ canRaiseSos: true }),
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'SOS' })).toBeInTheDocument();
    rerender(<RideDetails ride={rideView({ viewerRole: 'rider', trip: tripView() })} />);
    expect(screen.queryByRole('button', { name: 'SOS' })).not.toBeInTheDocument();
  });

  it('tells a no-show they owe nothing', () => {
    render(
      <RideDetails
        ride={rideView({
          viewerRole: 'rider',
          state: 'pickup_in_progress',
          isLocked: true,
          isOpen: false,
          trip: tripView({ viewerNoShow: true }),
          viewerShare: null,
          estimatedShare: null,
        })}
      />,
    );
    expect(screen.getByRole('region', { name: 'Nothing to pay' })).toHaveTextContent(
      'You were marked as a no-show',
    );
  });

  it('says when a completed ride was marked completed', () => {
    render(
      <RideDetails
        ride={rideView({
          state: 'completed',
          completedAt: '2026-10-10T02:35:00.000Z',
          isOpen: false,
          isLocked: true,
          windowEnded: true,
          estimatedShare: null,
        })}
      />,
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Marked completed Sat 10 Oct, 08:05')).toBeInTheDocument();
  });
});

describe('RideDetails: the link to rate (CS455-43)', () => {
  const completed = (review: RideView['review'], change: Partial<RideView> = {}) =>
    rideView({
      state: 'completed',
      completedAt: '2026-10-10T02:35:00.000Z',
      isOpen: false,
      isLocked: true,
      windowEnded: true,
      estimatedShare: null,
      viewerRole: 'rider',
      viewerShare: 175,
      review,
      ...change,
    });

  it('links the people on the ride to the review page while rating is open', () => {
    render(
      <RideDetails
        ride={completed({ window: 'open', closesAt: '2026-10-13T02:35:00.000Z', leftToRate: 1 })}
      />,
    );
    expect(screen.getByRole('link', { name: 'Rate the people on this ride' })).toHaveAttribute(
      'href',
      '/rides/0b9a7c1e-1111-4000-8000-000000000001/review',
    );
    expect(screen.getByText('Open until Tue 13 Oct, 08:05')).toBeInTheDocument();
  });

  it('says so once the viewer has rated everyone', () => {
    render(
      <RideDetails
        ride={completed({ window: 'open', closesAt: '2026-10-13T02:35:00.000Z', leftToRate: 0 })}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Rate the people on this ride' })).toBeNull();
    expect(
      screen.getByText(
        'You rated everyone on this ride. Ratings count from Tue 13 Oct, 08:05, when rating closes.',
      ),
    ).toBeInTheDocument();
  });

  it('offers nothing once rating has closed, or when nobody else was on the ride', () => {
    const { rerender } = render(
      <RideDetails
        ride={completed({ window: 'closed', closesAt: '2026-10-13T02:35:00.000Z', leftToRate: 1 })}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Rate the people on this ride' })).toBeNull();
    rerender(
      <RideDetails
        ride={completed(
          { window: 'open', closesAt: '2026-10-13T02:35:00.000Z', leftToRate: 0 },
          { occupantCount: 1, occupants: [owner] },
        )}
      />,
    );
    expect(screen.queryByText(/You rated everyone/)).toBeNull();
  });

  it('links the people on the ride to the complaint form while it is open (CS455-53)', () => {
    const { rerender } = render(<RideDetails ride={rideView({ canComplain: true })} />);
    expect(screen.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
      'href',
      `/rides/${rideView().id}/complaint`,
    );
    rerender(<RideDetails ride={rideView({ canComplain: false })} />);
    expect(screen.queryByRole('link', { name: 'Report a problem' })).toBeNull();
  });
});

describe('RideDetails: public ratings (CS455-44)', () => {
  it("FR-RD-02.4: shows a person's average only when they have one", () => {
    render(
      <RideDetails
        ride={rideView({ occupants: [{ ...owner, rating: { average: 4.25, count: 7 } }, rider] })}
      />,
    );
    expect(
      screen.getByText(/3 completed trips · 4\.3 out of 5 from 7 ratings · Quiet ride/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/out of 5/)).toHaveLength(1);
  });
});
