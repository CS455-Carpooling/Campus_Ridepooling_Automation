import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RatingPage, RatingPerson } from '@/lib/ride-ratings';
import { RideReview } from './RideReview';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const owner: RatingPerson = {
  occupantId: 'a1a1a1a1-3333-4000-8000-000000000002',
  name: 'Ananya Rao',
  isOwner: true,
  campusPlace: 'Hall 6',
  rated: false,
};
const rider: RatingPerson = {
  occupantId: 'a1a1a1a1-3333-4000-8000-000000000003',
  name: 'Meera Iyer',
  isOwner: false,
  campusPlace: 'Main Gate',
  rated: false,
};

// Left campus 06:30 to 07:30 IST on Saturday 10 October 2026; completed at 08:05, so rating
// closes at 08:05 IST on Tuesday 13 October.
function page(change: Partial<RatingPage> = {}): RatingPage {
  return {
    rideId: RIDE_ID,
    title: 'To Kanpur Central',
    direction: 'to_hub',
    departureStart: '2026-10-10T01:00:00.000Z',
    departureEnd: '2026-10-10T02:00:00.000Z',
    state: 'completed',
    window: 'open',
    completedAt: '2026-10-10T02:35:00.000Z',
    closesAt: '2026-10-13T02:35:00.000Z',
    viewerRole: 'rider',
    people: [owner, rider],
    ...change,
  };
}

const panel = () => screen.getAllByRole('region')[0];

describe('RideReview', () => {
  it('names the ride, its window, its state and how many were on it', () => {
    render(<RideReview page={page()} />);
    expect(screen.getByText('Rate this ride')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'To Kanpur Central' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sat 10 Oct, 06:30 to 07:30')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('3 people on this ride, you included')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the ride' })).toHaveAttribute(
      'href',
      `/rides/${RIDE_ID}`,
    );
  });

  it('shows the form, with when rating closes, while someone is left to rate', () => {
    render(<RideReview page={page()} />);
    expect(screen.getByRole('region', { name: 'Rating is open until' })).toHaveTextContent(
      'Tue 13 Oct, 08:05',
    );
    expect(screen.getByText(/Nobody sees who gave which score/)).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'The people you travelled with' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Already rated' })).toBeNull();
  });

  it('lists the people already rated above the form, which offers only the rest', () => {
    render(<RideReview page={page({ people: [{ ...owner, rated: true }, rider] })} />);
    const ratedList = screen.getByRole('region', { name: 'Already rated' });
    expect(within(ratedList).getByText('Ananya Rao')).toBeInTheDocument();
    expect(within(ratedList).getByText('Rated')).toBeInTheDocument();
    const form = screen.getByRole('form');
    expect(within(form).queryByText(/Ananya Rao/)).toBeNull();
    expect(within(form).getByRole('heading', { level: 3 })).toHaveTextContent('Meera Iyer');
  });

  it('says when the viewer has rated everyone, and when their ratings count', () => {
    render(
      <RideReview
        page={page({
          people: [
            { ...owner, rated: true },
            { ...rider, rated: true },
          ],
        })}
      />,
    );
    expect(panel()).toHaveAccessibleName('You rated everyone on this ride');
    expect(panel()).toHaveTextContent('2 of 2');
    expect(panel()).toHaveTextContent('Your ratings count from Tue 13 Oct, 08:05');
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.getAllByText('Rated')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Your rides' })).toHaveAttribute('href', '/dashboard');
  });

  it('US-RD-28 AC1: closes the form after 72 hours and says whom the viewer rated', () => {
    render(
      <RideReview page={page({ window: 'closed', people: [{ ...owner, rated: true }, rider] })} />,
    );
    expect(panel()).toHaveAccessibleName('Rating closed on');
    expect(panel()).toHaveTextContent('You rated 1 of 2 people.');
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.getByText('Not rated')).toBeInTheDocument();
  });

  it('explains that a ride must be completed first, to the owner and to riders', () => {
    const notCompleted = {
      window: 'not_completed',
      state: 'scheduled',
      completedAt: null,
      closesAt: null,
    } as const;
    const { rerender } = render(
      <RideReview page={page({ ...notCompleted, viewerRole: 'owner' })} />,
    );
    expect(panel()).toHaveAccessibleName('Rating is not open yet');
    expect(
      screen.getByText(/You can mark the ride completed from the ride page/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).toBeNull();
    rerender(<RideReview page={page(notCompleted)} />);
    expect(
      screen.getByText(/The owner can mark the ride completed from the ride page/),
    ).toBeInTheDocument();
  });

  it('says a cancelled ride cannot be rated', () => {
    render(
      <RideReview
        page={page({ window: 'cancelled', state: 'cancelled', completedAt: null, closesAt: null })}
      />,
    );
    expect(panel()).toHaveAccessibleName('This ride was cancelled');
    expect(panel()).toHaveTextContent('A cancelled ride cannot be rated.');
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('copes with a ride nobody else was on', () => {
    render(<RideReview page={page({ people: [], viewerRole: 'owner' })} />);
    expect(panel()).toHaveAccessibleName('Nobody else was on this ride');
    expect(screen.getByText('1 person on this ride, you included')).toBeInTheDocument();
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('calls places drop-off points on a ride back to campus', () => {
    render(<RideReview page={page({ direction: 'from_hub', title: 'From Kanpur Central' })} />);
    expect(screen.getByText('Drop-off: Hall 6')).toBeInTheDocument();
  });
});
