import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComplaintStatusActions } from './ComplaintStatusActions';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const reply = (status: number, body: object) =>
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(body, { status }));
const body = (call = 0) => JSON.parse(String(vi.mocked(fetch).mock.calls[call][1]?.body));

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ComplaintStatusActions (OA-FR-18, CS455-53)', () => {
  it('moves a submitted complaint under review with its version, then reads the page again', async () => {
    render(<ComplaintStatusActions complaintId="c1" status="submitted" version={1} />);
    reply(200, { complaint: {} });
    await userEvent.click(screen.getByRole('button', { name: 'Mark under review' }));
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/admin/complaints/c1');
    expect(body()).toEqual({ status: 'under_review', version: 1 });
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it('offers no under-review step once a complaint is under review', () => {
    render(<ComplaintStatusActions complaintId="c1" status="under_review" version={2} />);
    expect(screen.queryByRole('button', { name: 'Mark under review' })).not.toBeInTheDocument();
  });

  it('needs whether action was taken before resolving', async () => {
    render(<ComplaintStatusActions complaintId="c1" status="under_review" version={2} />);
    await userEvent.click(screen.getByRole('button', { name: 'Resolve complaint' }));
    expect(screen.getByText('Say whether any action was taken.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolves with the outcome and a note', async () => {
    render(<ComplaintStatusActions complaintId="c1" status="under_review" version={2} />);
    await userEvent.click(screen.getByRole('radio', { name: /No action was taken/ }));
    await userEvent.type(
      screen.getByLabelText('Note for the record (optional)'),
      'Talked to both.',
    );
    reply(200, { complaint: {} });
    await userEvent.click(screen.getByRole('button', { name: 'Resolve complaint' }));
    expect(body()).toEqual({
      status: 'resolved',
      actionTaken: false,
      note: 'Talked to both.',
      version: 2,
    });
  });

  it('on a conflict says so and shows the complaint as it is now', async () => {
    render(<ComplaintStatusActions complaintId="c1" status="under_review" version={2} />);
    await userEvent.click(screen.getByRole('radio', { name: /Yes, action was taken/ }));
    reply(409, {
      error: 'Someone else changed this since you opened it.',
      code: 'version_conflict',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Resolve complaint' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The page now shows the complaint as it is.',
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows other refusals, and sends someone whose session ended to sign in', async () => {
    render(<ComplaintStatusActions complaintId="c1" status="submitted" version={1} />);
    reply(500, {
      error: 'The change could not be saved, so nothing was changed.',
      code: 'server_error',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Mark under review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nothing was changed');
    reply(401, {});
    await userEvent.click(screen.getByRole('button', { name: 'Mark under review' }));
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
  });
});
