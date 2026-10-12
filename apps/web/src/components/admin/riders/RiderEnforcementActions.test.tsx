import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiderEnforcementActions } from './RiderEnforcementActions';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const complaints = [{ id: 'complaint-1', reference: 'CMP-12345678', category: 'safety' as const }];

const reply = (status: number, body: object) =>
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(body, { status }));
const sent = () => {
  const [url, request] = vi.mocked(fetch).mock.calls[0];
  return { url, body: JSON.parse(String(request?.body)) };
};

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderActions(suspended = false) {
  render(
    <RiderEnforcementActions
      riderId="rider-1"
      isAdmin={false}
      suspended={suspended}
      complaints={complaints}
    />,
  );
}

describe('RiderEnforcementActions (OA-FR-21, OA-FR-23, OA-FR-28, CS455-54)', () => {
  it('requires a reason category and an explicit suspension duration choice', async () => {
    renderActions();
    const form = within(screen.getByRole('form', { name: 'Suspend rider account' }));
    expect(form.getByLabelText('Reason category')).toHaveValue('');
    expect(form.getByLabelText('Suspension length in days')).toHaveValue(null);
    await userEvent.click(form.getByRole('button', { name: 'Review suspension' }));
    expect(await form.findByText('Choose what the suspension is for.')).toBeInTheDocument();
    expect(
      form.getByText('Choose a length from 1 to 3650 days, or indefinite.'),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires confirmation before issuing a warning and shows success only after the server replies', async () => {
    renderActions();
    const form = within(screen.getByRole('form', { name: 'Issue rider warning' }));
    await userEvent.type(form.getByLabelText('Reason'), 'Repeated unsafe behavior.');
    await userEvent.click(form.getByRole('button', { name: 'Review warning' }));
    expect(screen.getByText('Issue this warning?')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    reply(201, { warning: { id: 'warning-1' } });
    await userEvent.click(form.getByRole('button', { name: 'Confirm warning' }));
    expect(sent()).toEqual({
      url: '/api/admin/riders/rider-1/warnings',
      body: { reason: 'Repeated unsafe behavior.', complaintId: null },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Warning issued.');
  });

  it('confirms a timed suspension and sends the chosen duration', async () => {
    renderActions();
    const form = within(screen.getByRole('form', { name: 'Suspend rider account' }));
    await userEvent.selectOptions(form.getByLabelText('Reason category'), 'safety');
    await userEvent.type(form.getByLabelText('Reason'), 'Repeated unsafe behavior.');
    await userEvent.type(form.getByLabelText('Suspension length in days'), '30');
    await userEvent.click(form.getByRole('button', { name: 'Review suspension' }));
    expect(screen.getByText('Suspend this rider for 30 days?')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    reply(201, { suspension: { id: 'suspension-1' } });
    await userEvent.click(form.getByRole('button', { name: 'Confirm suspension' }));
    expect(sent()).toEqual({
      url: '/api/admin/riders/rider-1/suspensions',
      body: {
        reasonCategory: 'safety',
        reason: 'Repeated unsafe behavior.',
        days: 30,
        indefinite: false,
        complaintId: null,
      },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Suspension saved.');
  });

  it('requires an explicit indefinite choice and confirms the suspension', async () => {
    renderActions();
    const form = within(screen.getByRole('form', { name: 'Suspend rider account' }));
    await userEvent.selectOptions(form.getByLabelText('Reason category'), 'safety');
    await userEvent.type(form.getByLabelText('Reason'), 'Repeated unsafe behavior.');
    await userEvent.click(form.getByLabelText('Indefinite suspension'));
    expect(form.queryByLabelText('Suspension length in days')).not.toBeInTheDocument();
    await userEvent.click(form.getByRole('button', { name: 'Review suspension' }));
    expect(screen.getByText('Suspend this rider indefinitely?')).toBeInTheDocument();
    reply(201, { suspension: { id: 'suspension-1' } });
    await userEvent.click(form.getByRole('button', { name: 'Confirm suspension' }));
    expect(sent().body).toMatchObject({ indefinite: true, days: null });
  });

  it('requires confirmation before reactivation and reports the saved result', async () => {
    renderActions(true);
    const form = within(screen.getByRole('form', { name: 'Reactivate rider account' }));
    await userEvent.type(form.getByLabelText('Reason for reactivation'), 'Review completed.');
    await userEvent.click(form.getByRole('button', { name: 'Review reactivation' }));
    expect(form.getByText('Reactivate this rider?')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    reply(200, { reactivation: { id: 'reactivation-1' } });
    await userEvent.click(form.getByRole('button', { name: 'Confirm reactivation' }));
    expect(sent()).toEqual({
      url: '/api/admin/riders/rider-1/reactivation',
      body: { reason: 'Review completed.' },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Rider reactivated.');
  });

  it('sends an expired admin session to sign-in after confirmation', async () => {
    renderActions();
    const form = within(screen.getByRole('form', { name: 'Issue rider warning' }));
    await userEvent.type(form.getByLabelText('Reason'), 'Repeated unsafe behavior.');
    await userEvent.click(form.getByRole('button', { name: 'Review warning' }));
    reply(401, { error: 'Authentication required.', code: 'unauthenticated' });
    await userEvent.click(form.getByRole('button', { name: 'Confirm warning' }));
    expect(router.push).toHaveBeenCalledWith('/login');
  });
});
