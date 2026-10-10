import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatComplaintQueue } from './ChatComplaintQueue';

const report = {
  reference: 'chat-12345678',
  ride_id: 'ride-1',
  message_id: 'message-1',
  reporter_name: 'Rider A',
  sender_name: 'Rider B',
  body: 'Problematic message',
  reason: 'Harassment',
  created_at: '2026-10-10T06:00:00.000Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ChatComplaintQueue', () => {
  it('shows the empty state', () => {
    render(<ChatComplaintQueue initialReports={[]} />);
    expect(screen.getByText('No open ride chat complaints.')).toBeInTheDocument();
  });

  it('resolves a complaint and removes it from the queue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'resolved' })));
    render(<ChatComplaintQueue initialReports={[report]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() =>
      expect(screen.getByText('No open ride chat complaints.')).toBeInTheDocument(),
    );
  });

  it('keeps a complaint visible and reports a failed resolution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Try again.' }, { status: 500 })),
    );
    render(<ChatComplaintQueue initialReports={[report]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again.');
    expect(screen.getByText('Problematic message')).toBeInTheDocument();
  });
});
