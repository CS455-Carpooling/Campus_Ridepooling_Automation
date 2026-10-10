'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type ChatMessagePayload = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  reported: boolean;
};

type ChatThreadPayload = {
  id: string;
  rideId: string;
  openedAt: string;
  readOnly: boolean;
  canWrite: boolean;
  messages: ChatMessagePayload[];
};

const CHAT_MESSAGE_LIMIT = 500;

export function RideChat({
  rideId,
  viewerRole,
}: {
  rideId: string;
  viewerRole: 'owner' | 'rider' | 'visitor';
}) {
  const [thread, setThread] = useState<ChatThreadPayload | null>(null);
  const [emptyMessage, setEmptyMessage] = useState('');
  const [message, setMessage] = useState('');
  const [reportingMessageId, setReportingMessageId] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/rides/${rideId}/chat`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setThread(null);
          return;
        }
        throw new Error('Unable to load chat.');
      }
      const data = (await res.json()) as {
        thread?: ChatThreadPayload | null;
        error?: string;
        message?: string;
      };
      setThread(data.thread ?? null);
      setEmptyMessage(data.message ?? '');
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load chat.');
    }
  }, [rideId]);

  useEffect(() => {
    if (viewerRole === 'visitor') return;

    void Promise.resolve().then(loadThread);

    const socket = io({
      path: '/socket.io/',
      transports: ['websocket'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('ride:chat:join', { rideId });
    });

    socket.on('ride:chat:joined', () => {
      void loadThread();
    });

    socket.on('ride:chat:opened', (payload: { rideId: string }) => {
      if (payload.rideId === rideId) void loadThread();
    });

    socket.on('ride:chat:closed', (payload: { rideId: string; readOnly: boolean }) => {
      if (payload.rideId !== rideId) return;
      setThread((current) =>
        current ? { ...current, canWrite: false, readOnly: payload.readOnly } : current,
      );
    });

    socket.on(
      'ride:chat:message',
      (payload: {
        rideId: string;
        id: string;
        senderId: string;
        senderName: string;
        body: string;
        createdAt: string;
        isMine?: boolean;
        reported?: boolean;
      }) => {
        if (payload.rideId !== rideId) return;
        setThread((current) => {
          if (!current) return current;
          const exists = current.messages.some((item) => item.id === payload.id);
          if (exists) return current;
          return {
            ...current,
            messages: [
              ...current.messages,
              {
                id: payload.id,
                senderId: payload.senderId,
                senderName: payload.senderName,
                body: payload.body,
                createdAt: payload.createdAt,
                isMine: Boolean(payload.isMine),
                reported: Boolean(payload.reported),
              },
            ],
          };
        });
      },
    );

    socket.on('ride:chat:error', (payload: { error?: string }) => {
      if (payload.error) setError(payload.error);
    });

    return () => {
      socket.emit('ride:chat:leave', { rideId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadThread, rideId, viewerRole]);

  useEffect(() => {
    if (viewerRole === 'visitor' || thread) return;
    const refreshUntilOpen = window.setInterval(() => void loadThread(), 15_000);
    return () => window.clearInterval(refreshUntilOpen);
  }, [loadThread, thread, viewerRole]);

  const showComposer = viewerRole !== 'visitor' && thread && thread.canWrite;
  const headerText = thread
    ? thread.readOnly
      ? 'Pool chat is now read-only.'
      : thread.canWrite
        ? 'Pool chat'
        : 'Pool chat is closed to new messages.'
    : 'Pool chat';

  const sendChatMessage = async (rawMessage: string) => {
    if (!rawMessage.trim() || busy || !thread) return;
    const body = rawMessage.trim();
    setBusy(true);
    setError('');

    try {
      const socket = socketRef.current;
      if (!socket?.connected) {
        setError('The live chat connection is unavailable. Reconnect and try again.');
        return;
      }
      const response = await new Promise<{
        ok: boolean;
        error?: string;
        message?: ChatMessagePayload;
      }>((resolve, reject) => {
        socket
          .timeout(10_000)
          .emit(
            'ride:chat:message',
            { rideId, message: body },
            (
              timeoutError: Error | null,
              result: { ok: boolean; error?: string; message?: ChatMessagePayload },
            ) => {
              if (timeoutError) {
                reject(new Error('Message was not acknowledged. Check the chat before retrying.'));
              } else resolve(result);
            },
          );
      });
      if (!response.ok || !response.message) {
        setError(response.error ?? 'Message could not be sent.');
        return;
      }
      const sentMessage = response.message;
      setMessage((current) => (current.trim() === body ? '' : current));
      setThread((current) =>
        current && !current.messages.some((item) => item.id === sentMessage.id)
          ? { ...current, messages: [...current.messages, sentMessage] }
          : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendChatMessage(message);
  };

  const reportMessage = async (event: React.FormEvent<HTMLFormElement>, messageId: string) => {
    event.preventDefault();
    if (!messageId || !thread || reportBusy) return;
    setReportBusy(true);
    try {
      const res = await fetch(`/api/rides/${rideId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'report', messageId, reason: reportReason.trim() }),
      });
      const data = (await res.json()) as { error?: string; reference?: string };
      if (!res.ok) {
        setError(data.error ?? 'The message could not be reported.');
        return;
      }
      setThread((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.id === messageId ? { ...item, reported: true } : item,
              ),
            }
          : current,
      );
      setReportingMessageId('');
      setReportReason('');
      const reference = data.reference ?? `chat-${messageId.slice(0, 8)}`;
      setError(`Your report was sent to the operations team. Reference: ${reference}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The message could not be reported.');
    } finally {
      setReportBusy(false);
    }
  };

  if (viewerRole === 'visitor') return null;

  return (
    <section
      aria-labelledby="ride-chat-heading"
      className="mt-10 rounded-panel border border-line bg-surface p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="ride-chat-heading" className="text-xl font-bold tracking-tight">
          {headerText}
        </h2>
        {thread && thread.canWrite && (
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
            Live
          </span>
        )}
      </div>

      {!thread && (
        <p className="text-sm text-ink-muted">
          {emptyMessage ||
            'Pool chat opens once the ride locks and only current members can read or post.'}
        </p>
      )}

      {thread && thread.messages.length === 0 && (
        <p className="text-sm text-ink-muted">No messages yet. Start the conversation.</p>
      )}

      {thread && (
        <div className="space-y-3">
          {thread.messages.map((item) => (
            <div
              key={item.id}
              className={`rounded-control border border-line bg-panel p-3 ${item.isMine ? 'ml-4' : 'mr-4'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{item.senderName}</p>
                <time className="text-[11px] text-ink-muted" dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.body}</p>
              {!item.isMine &&
                (item.reported ? (
                  <p className="mt-2 text-xs font-semibold text-ink-muted">Reported</p>
                ) : reportingMessageId === item.id ? (
                  <form
                    onSubmit={(event) => void reportMessage(event, item.id)}
                    className="mt-3 space-y-2"
                  >
                    <label
                      className="block text-xs font-medium text-ink-muted"
                      htmlFor={`ride-chat-report-${item.id}`}
                    >
                      Tell the operations team why you are reporting this message.
                    </label>
                    <textarea
                      id={`ride-chat-report-${item.id}`}
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                      maxLength={500}
                      required
                      rows={2}
                      className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!reportReason.trim() || reportBusy}
                        className="rounded-control border border-primary bg-primary px-3 py-2 text-xs font-semibold text-on-primary disabled:opacity-60"
                      >
                        {reportBusy ? 'Submitting…' : 'Submit report'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportingMessageId('');
                          setReportReason('');
                        }}
                        className="rounded-control border border-line px-3 py-2 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-accent-text underline-offset-2 hover:underline"
                    onClick={() => setReportingMessageId(item.id)}
                  >
                    Report
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {showComposer && (
        <form onSubmit={sendMessage} className="mt-4 space-y-3">
          <label
            className="block text-sm font-medium text-ink-muted"
            htmlFor={`ride-chat-message-${rideId}`}
          >
            Message the pool
          </label>
          <textarea
            id={`ride-chat-message-${rideId}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={CHAT_MESSAGE_LIMIT}
            className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none ring-0 focus:border-line-strong"
            placeholder="Tell the group about pickup, delays, or route changes."
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">
              {message.trim().length}/{CHAT_MESSAGE_LIMIT}
            </span>
            <button
              type="submit"
              disabled={busy || !message.trim()}
              className="rounded-control border border-primary bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send message'}
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendChatMessage('I am at the pickup point.')}
            className="rounded-control border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            I am at the pickup point
          </button>
        </form>
      )}

      {thread && !thread.canWrite && (
        <p className="mt-3 text-sm text-ink-muted">
          {thread.readOnly
            ? 'This chat is read-only. Messages were kept for 30 days after the 24-hour read-only period, unless a report requires review.'
            : 'The ride was cancelled. Chat history remains available, but new messages are not accepted.'}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
