import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RatingPerson } from '@/lib/ride-ratings';
import { RatingForm } from './RatingForm';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const RIDE_ID = '0b9a7c1e-1111-4000-8000-000000000001';
const OWNER_SEAT = 'a1a1a1a1-3333-4000-8000-000000000002';
const RIDER_SEAT = 'a1a1a1a1-3333-4000-8000-000000000003';

const people: RatingPerson[] = [
  {
    occupantId: OWNER_SEAT,
    name: 'Ananya Rao',
    isOwner: true,
    campusPlace: 'Hall 6',
    rated: false,
  },
  {
    occupantId: RIDER_SEAT,
    name: 'Meera Iyer',
    isOwner: false,
    campusPlace: 'Main Gate',
    rated: false,
  },
];

const fetchMock = vi.fn();
function answer(status: number, body: object = {}) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

function setup() {
  const user = userEvent.setup();
  render(
    <RatingForm
      rideId={RIDE_ID}
      people={people}
      closesAt="Tue 13 Oct, 08:05"
      placeLabel="Pickup"
    />,
  );
  const card = (name: string) => within(screen.getByRole('region', { name: new RegExp(name) }));
  return { user, card };
}

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('RatingForm (FR-RD-12.1 to 12.4)', () => {
  it('shows a card per person with their role, place, scores and a comment box', () => {
    const { card } = setup();
    const ananya = card('Ananya Rao');
    expect(ananya.getByRole('heading', { level: 3 })).toHaveTextContent('Ananya Rao (Ride owner)');
    expect(ananya.getByText('Pickup: Hall 6')).toBeInTheDocument();
    expect(ananya.getByRole('group', { name: /Score for Ananya Rao/ })).toBeInTheDocument();
    expect(ananya.getByRole('textbox', { name: 'Comment (optional)' })).toHaveAccessibleDescription(
      /Only Ananya Rao will see this, without your name or score, once they have 3 ratings\./,
    );
    expect(card('Meera Iyer').getByRole('heading', { level: 3 })).toHaveTextContent('(Rider)');
    expect(
      screen.getByText(
        /0 of 2 scored\. Anyone you skip can still be rated until Tue 13 Oct, 08:05\./,
      ),
    ).toBeInTheDocument();
  });

  it('asks for a score before sending anything', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a score for at least one person first.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('US-RD-28 AC4: points to the complaint contact for a score of 1 or 2 only', async () => {
    const { user, card } = setup();
    const ananya = card('Ananya Rao');
    await user.click(ananya.getByRole('radio', { name: '2, Fair' }));
    expect(ananya.getByText('Was there a problem on this trip?')).toBeInTheDocument();
    expect(ananya.getByRole('link', { name: 'campusridepooling@iitk.ac.in' })).toHaveAttribute(
      'href',
      'mailto:campusridepooling@iitk.ac.in',
    );
    await user.click(ananya.getByRole('radio', { name: '3, Good' }));
    expect(ananya.queryByText('Was there a problem on this trip?')).toBeNull();
  });

  it('sends only the people given a score, with trimmed comments, and reads the page again', async () => {
    answer(201, { rated: 1 });
    const { user, card } = setup();
    const ananya = card('Ananya Rao');
    await user.click(ananya.getByRole('radio', { name: '4, Very good' }));
    await user.type(ananya.getByRole('textbox'), '  Waited for me at the gate.  ');
    await user.type(card('Meera Iyer').getByRole('textbox'), 'Not scored, so not sent.');
    expect(screen.getByText(/1 of 2 scored/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/rides/${RIDE_ID}/ratings`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(sentBody()).toEqual({
      ratings: [{ occupantId: OWNER_SEAT, score: 4, comment: 'Waited for me at the gate.' }],
    });
    expect(screen.getByText('Rating sent for 1 person.')).toBeInTheDocument();
  });

  it('counts several people in the confirmation and sends an empty comment as none', async () => {
    answer(201, { rated: 2 });
    const { user, card } = setup();
    await user.click(card('Ananya Rao').getByRole('radio', { name: '5, Excellent' }));
    await user.click(card('Meera Iyer').getByRole('radio', { name: '1, Poor' }));
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));
    expect(await screen.findByText('Ratings sent for 2 people.')).toBeInTheDocument();
    expect(sentBody().ratings.map((rating: { comment: unknown }) => rating.comment)).toEqual([
      null,
      null,
    ]);
  });

  it('checks the request with the same rules as the server before sending it', async () => {
    const { user, card } = setup();
    const ananya = card('Ananya Rao');
    await user.click(ananya.getByRole('radio', { name: '4, Very good' }));
    // A pasted comment can get past the box's own limit in some browsers.
    fireEvent.change(ananya.getByRole('textbox'), { target: { value: 'a'.repeat(501) } });
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Keep each comment to 500 characters or fewer.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows why the server refused, and reads the page again when it is out of date', async () => {
    answer(409, {
      error: 'Rating for this ride closed 72 hours after it was completed.',
      code: 'closed',
    });
    const { user, card } = setup();
    await user.click(card('Ananya Rao').getByRole('radio', { name: '4, Very good' }));
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Rating for this ride closed 72 hours after it was completed.',
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it('keeps the page as it is for other refusals, with a general message when none is given', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 500 }));
    const { user, card } = setup();
    await user.click(card('Ananya Rao').getByRole('radio', { name: '4, Very good' }));
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to send the ratings right now.',
    );
    expect(router.refresh).not.toHaveBeenCalled();
    expect(card('Ananya Rao').getByRole('radio', { name: '4, Very good' })).toBeEnabled();
  });

  it('sends someone whose sign-in expired to the sign-in page', async () => {
    answer(401, { error: 'Authentication required.' });
    const { user, card } = setup();
    await user.click(card('Ananya Rao').getByRole('radio', { name: '4, Very good' }));
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { user, card } = setup();
    await user.click(card('Ananya Rao').getByRole('radio', { name: '4, Very good' }));
    await user.click(screen.getByRole('button', { name: 'Send ratings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server.');
  });

  it('works by keyboard alone', async () => {
    answer(201, { rated: 1 });
    const { user, card } = setup();
    await user.tab();
    expect(card('Ananya Rao').getByRole('radio', { name: '1, Poor' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(card('Ananya Rao').getByRole('radio', { name: '3, Good' })).toBeChecked();
    // Comment, Meera's score group, Meera's comment, then the button.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Send ratings' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().ratings).toEqual([{ occupantId: OWNER_SEAT, score: 3, comment: null }]);
  });
});
