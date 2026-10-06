import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RideView } from '@/lib/ride-view';
import { RideDetails } from './RideDetails';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const owner = {
  name: 'Ananya Rao',
  campusPlace: 'Hall 6',
  isOwner: true,
  isViewer: false,
  visibleTags: ['Quiet ride'],
  completedTrips: 3,
  share: 175,
};
const rider = {
  name: 'Kabir Shah',
  campusPlace: 'Hall 3',
  isOwner: false,
  isViewer: false,
  visibleTags: [],
  completedTrips: 1,
  share: 175,
};

// Leaves campus 06:30 to 07:30 IST on Saturday 10 October 2026; read at 21:12:05 IST the night before.
function rideView(change: Partial<RideView> = {}): RideView {
  return {
    id: '0b9a7c1e-1111-4000-8000-000000000001',
    direction: 'to_hub',
    hub: { name: 'Kanpur Central', detail: 'Railway station' },
    departureStart: '2026-10-10T01:00:00.000Z',
    departureEnd: '2026-10-10T02:00:00.000Z',
    lockAt: '2026-10-10T00:00:00.000Z',
    state: 'scheduled',
    isLocked: false,
    isOpen: true,
    windowEnded: false,
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
      'The ride is locked, so this share is fixed.',
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
