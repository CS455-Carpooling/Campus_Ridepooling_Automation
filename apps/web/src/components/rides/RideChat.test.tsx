import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketMocks = vi.hoisted(() => {
  type Ack = (
    error: Error | null,
    response: {
      ok: boolean;
      message?: {
        id: string;
        senderId: string;
        senderName: string;
        body: string;
        createdAt: string;
        isMine: boolean;
        reported: boolean;
      };
    },
  ) => void;
  const socket: {
    connected: boolean;
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    timeout: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  } = {
    connected: true,
    on: vi.fn(),
    emit: vi.fn(),
    timeout: vi.fn(),
    disconnect: vi.fn(),
  };
  socket.timeout.mockReturnValue(socket);
  socket.emit.mockImplementation(
    (event: string, payload: { message?: string }, acknowledgement?: Ack) => {
      if (event === 'ride:chat:message' && acknowledgement) {
        acknowledgement(null, {
          ok: true,
          message: {
            id: `message-${socket.emit.mock.calls.length}`,
            senderId: 'rider-1',
            senderName: 'Rider One',
            body: payload.message ?? '',
            createdAt: '2026-10-10T06:00:00.000Z',
            isMine: true,
            reported: false,
          },
        });
      }
      return socket;
    },
  );
  socket.on.mockImplementation((event: string, listener: () => void) => {
    if (event === 'connect') listener();
    return socket;
  });
  return { socket };
});

vi.mock('socket.io-client', () => ({ io: () => socketMocks.socket }));

import { RideChat } from './RideChat';

const thread = {
  id: 'chat-1',
  rideId: 'ride-1',
  openedAt: '2026-10-10T06:00:00.000Z',
  readOnly: false,
  canWrite: true,
  messages: [
    {
      id: 'incoming-1',
      senderId: 'rider-2',
      senderName: 'Rider Two',
      body: 'At the north gate.',
      createdAt: '2026-10-10T06:00:00.000Z',
      isMine: false,
      reported: false,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  socketMocks.socket.connected = true;
  socketMocks.socket.timeout.mockReturnValue(socketMocks.socket);
  socketMocks.socket.emit.mockImplementation(
    (
      event: string,
      payload: { message?: string },
      acknowledgement?: (
        error: Error | null,
        response: {
          ok: boolean;
          message?: {
            id: string;
            senderId: string;
            senderName: string;
            body: string;
            createdAt: string;
            isMine: boolean;
            reported: boolean;
          };
        },
      ) => void,
    ) => {
      if (event === 'ride:chat:message' && acknowledgement) {
        acknowledgement(null, {
          ok: true,
          message: {
            id: `message-${socketMocks.socket.emit.mock.calls.length}`,
            senderId: 'rider-1',
            senderName: 'Rider One',
            body: payload.message ?? '',
            createdAt: '2026-10-10T06:00:00.000Z',
            isMine: true,
            reported: false,
          },
        });
      }
      return socketMocks.socket;
    },
  );
  socketMocks.socket.on.mockImplementation((event, listener) => {
    if (event === 'connect') listener();
    return socketMocks.socket;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === 'POST'
        ? Response.json({ reference: 'chat-12345678' })
        : Response.json({ thread }),
    ),
  );
});

describe('RideChat', () => {
  it('sends normal and one-tap messages live and submits a report with evidence', async () => {
    render(<RideChat rideId="ride-1" viewerRole="rider" />);

    const messageBox = await screen.findByLabelText('Message the pool');
    fireEvent.change(messageBox, { target: { value: 'Running five minutes late.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(socketMocks.socket.emit).toHaveBeenCalledWith(
        'ride:chat:message',
        { rideId: 'ride-1', message: 'Running five minutes late.' },
        expect.any(Function),
      ),
    );
    expect(await screen.findByText('Running five minutes late.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'I am at the pickup point' }));
    await waitFor(() =>
      expect(socketMocks.socket.emit).toHaveBeenCalledWith(
        'ride:chat:message',
        { rideId: 'ride-1', message: 'I am at the pickup point.' },
        expect.any(Function),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    fireEvent.change(
      screen.getByLabelText('Tell the operations team why you are reporting this message.'),
      {
        target: { value: 'This message contains harassment.' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(screen.getByText(/Reference: chat-12345678/)).toBeInTheDocument());
  });
});
