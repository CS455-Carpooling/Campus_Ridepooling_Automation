import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }));

import { WarningAcknowledgement } from './WarningAcknowledgement';

const warnings = [
  { id: 'warning-1', reasonCategory: 'safety' as const, issuedAt: '2026-10-13T12:00:00.000Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe('WarningAcknowledgement', () => {
  it('shows the category and requires an explicit acknowledgement', async () => {
    render(<WarningAcknowledgement warnings={warnings} />);
    expect(screen.getByText('Reason category: Safety')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge Safety warning' }));
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith('/api/warnings/warning-1/acknowledge', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('shows an explicit error when acknowledgement fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Unable to acknowledge this warning right now.' }),
      }),
    );
    render(<WarningAcknowledgement warnings={warnings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge Safety warning' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to acknowledge this warning right now.',
    );
    expect(h.refresh).not.toHaveBeenCalled();
  });
});
