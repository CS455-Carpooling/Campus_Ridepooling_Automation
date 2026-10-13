import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComplaintFormPage } from '@/lib/complaint-queries';
import { ComplaintForm } from './ComplaintForm';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const OWNER_SEAT = 'a1a1a1a1-3333-4000-8000-000000000001';
const RIDER_SEAT = 'a1a1a1a1-3333-4000-8000-000000000002';
const MESSAGE = 'eeeeeeee-4444-4000-8000-000000000001';

const page = (change: Partial<ComplaintFormPage> = {}): ComplaintFormPage => ({
  rideId: RIDE,
  title: 'Hall 6 to Kanpur Central',
  direction: 'to_hub',
  departureStart: '2026-10-10T01:00:00.000Z',
  departureEnd: '2026-10-10T02:00:00.000Z',
  state: 'completed',
  window: 'open',
  closesAt: '2026-10-17T03:00:00.000Z',
  people: [
    {
      occupantId: OWNER_SEAT,
      name: 'Rohan Verma',
      isOwner: true,
      campusPlace: 'Hall 6',
      filedReference: null,
    },
    {
      occupantId: RIDER_SEAT,
      name: 'Dev Patel',
      isOwner: false,
      campusPlace: 'Hall 1',
      filedReference: null,
    },
  ],
  message: null,
  sosAvailable: false,
  ...change,
});

const description = 'Arrived 25 minutes late to the pickup point.';

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fill(category = 'Tardiness') {
  await userEvent.click(screen.getByRole('radio', { name: /Rohan Verma/ }));
  await userEvent.click(screen.getByRole('radio', { name: new RegExp(`^${category}`) }));
  await userEvent.type(screen.getByLabelText('Describe what happened'), description);
}

describe('ComplaintForm (FR-RD-13.1 to 13.6, CS455-53)', () => {
  it('offers everyone else on the ride by seat, and the six categories', () => {
    render(<ComplaintForm page={page()} />);
    const who = within(screen.getByRole('group', { name: 'Who is the complaint about?' }));
    expect(who.getByRole('radio', { name: /Rohan Verma/ })).toHaveAccessibleDescription(
      'Ride owner, Hall 6',
    );
    expect(who.getByRole('radio', { name: /Dev Patel/ })).toHaveAccessibleDescription(
      'Rider, Hall 1',
    );
    expect(
      within(screen.getByRole('group', { name: 'What happened?' })).getAllByRole('radio'),
    ).toHaveLength(6);
  });

  it('shows the emergency numbers when Safety is chosen (FR-RD-13.6)', async () => {
    render(<ComplaintForm page={page()} />);
    expect(screen.queryByRole('region', { name: 'Emergency contacts' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Safety/ }));
    const contacts = screen.getByRole('region', { name: 'Emergency contacts' });
    expect(within(contacts).getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
    expect(
      within(contacts).getByRole('link', { name: '0512-259-7999' }),
    ).toHaveAttribute('href', 'tel:05122597999');
    expect(contacts).toHaveTextContent('does not contact emergency services for you');
  });

  it('points to SOS on the ride page for Safety while the trip is under way (CS455-64)', async () => {
    render(<ComplaintForm page={page({ sosAvailable: true })} />);
    expect(screen.queryByRole('link', { name: 'SOS on the ride page' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Safety/ }));
    expect(screen.getByRole('link', { name: 'SOS on the ride page' })).toHaveAttribute(
      'href',
      `/rides/${RIDE}`,
    );
  });

  it('checks the form before sending', async () => {
    render(<ComplaintForm page={page()} />);
    await userEvent.type(screen.getByLabelText('Describe what happened'), 'Too short.');
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    expect(screen.getByText('Choose who the complaint is about.')).toBeInTheDocument();
    expect(screen.getByText('Choose what the complaint is about.')).toBeInTheDocument();
    expect(screen.getByText(/Describe what happened in 20 to 2000 characters/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the seat, category and words, and shows the reference (FR-RD-13.2)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ reference: 'CMP-1A2B3C4D' }, { status: 201 }),
    );
    render(<ComplaintForm page={page()} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`/api/rides/${RIDE}/complaints`);
    expect(JSON.parse(String(init?.body))).toEqual({
      occupantId: OWNER_SEAT,
      category: 'tardiness',
      description,
      messageId: null,
    });
    const done = await screen.findByRole('region', { name: 'Complaint sent' });
    expect(done).toHaveTextContent('CMP-1A2B3C4D');
    expect(done).toHaveFocus();
    expect(within(done).getByRole('link', { name: 'Your complaints' })).toHaveAttribute(
      'href',
      '/complaints',
    );
  });

  it('shows the API refusal, with field messages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        {
          error: 'You already filed complaint CMP-OLD00001 about this person on this ride.',
          code: 'already_filed',
        },
        { status: 409 },
      ),
    );
    render(<ComplaintForm page={page()} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('CMP-OLD00001');
  });

  it('sends someone whose session ended to sign in, and says when the connection failed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 401 }));
    render(<ComplaintForm page={page()} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/login'));

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server');
  });

  it('is about the sender of a reported message, and sends the message with it (FR-RD-09.6)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ reference: 'CMP-1A2B3C4D' }, { status: 201 }),
    );
    render(
      <ComplaintForm
        page={page({
          state: 'scheduled',
          window: 'not_completed',
          message: {
            id: MESSAGE,
            body: 'Hurry up or I leave.',
            sentAt: '2026-10-09T10:00:00.000Z',
            senderOccupantId: RIDER_SEAT,
          },
        })}
      />,
    );
    expect(screen.getByRole('region', { name: 'The message you are reporting' })).toHaveTextContent(
      'Hurry up or I leave.',
    );
    const who = within(screen.getByRole('group', { name: 'Who is the complaint about?' }));
    expect(who.getAllByRole('radio')).toHaveLength(1);
    expect(who.getByRole('radio', { name: /Dev Patel/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /^Harassment/ }));
    await userEvent.type(
      screen.getByLabelText('Describe what happened'),
      'Threatened to leave me behind in the chat.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      occupantId: RIDER_SEAT,
      messageId: MESSAGE,
    });
  });

  it('lists the people already complained about, and offers only the others', () => {
    render(
      <ComplaintForm
        page={page({
          people: [
            {
              occupantId: OWNER_SEAT,
              name: 'Rohan Verma',
              isOwner: true,
              campusPlace: 'Hall 6',
              filedReference: 'CMP-OLD00001',
            },
            {
              occupantId: RIDER_SEAT,
              name: 'Dev Patel',
              isOwner: false,
              campusPlace: 'Hall 1',
              filedReference: null,
            },
          ],
        })}
      />,
    );
    expect(
      screen.getByRole('list', { name: 'Complaints you already filed on this ride' }),
    ).toHaveTextContent('You already filed CMP-OLD00001 about Rohan Verma.');
    expect(
      within(screen.getByRole('group', { name: 'Who is the complaint about?' })).getAllByRole(
        'radio',
      ),
    ).toHaveLength(1);
  });

  it('says when everyone has been complained about already', () => {
    render(
      <ComplaintForm
        page={page({
          people: [
            {
              occupantId: OWNER_SEAT,
              name: 'Rohan Verma',
              isOwner: true,
              campusPlace: 'Hall 6',
              filedReference: 'CMP-OLD00001',
            },
          ],
        })}
      />,
    );
    expect(
      screen.getByText(/You have filed a complaint about everyone else on this ride/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send complaint' })).not.toBeInTheDocument();
  });
});
