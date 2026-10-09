'use client';

import { useEffect, useRef, useState } from 'react';
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
const COMPLAINT_EMAIL = 'campusridepooling@iitk.ac.in';

export function RideChat({
  rideId,
  viewerRole,
}: {
  rideId: string;
  viewerRole: 'owner' | 'rider' | 'visitor';
}) {
  const [thread, setThread] = useState<ChatThreadPayload | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const loadThread = async () => {
    try {
      const res = await fetch(`/api/rides/${rideId}/chat`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setThread(null);
          return;
        }
        throw new Error('Unable to load chat.');
      }
      const data = (await res.json()) as { thread?: ChatThreadPayload | null; error?: string };
      setThread(data.thread ?? null);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load chat.');
    }
  };

  useEffect(() => {
    if (viewerRole === 'visitor') return;

    void loadThread();

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

    socket.on('ride:chat:message', (payload: { rideId: string; id: string; senderId: string; senderName: string; body: string; createdAt: string; isMine?: boolean; reported?: boolean }) => {
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
    });

    socket.on('ride:chat:error', (payload: { error?: string }) => {
      if (payload.error) setError(payload.error);
    });

    return () => {
      socket.emit('ride:chat:leave', { rideId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [rideId, viewerRole]);

  const showComposer = viewerRole !== 'visitor' && thread && thread.canWrite;
  const headerText = thread ? (thread.readOnly ? 'Pool chat is now read-only.' : 'Pool chat') : 'Pool chat';

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim() || busy || !thread) return;

    const body = message.trim();
    setBusy(true);
    setError('');

    try {
      const res = await fetch(`/api/rides/${rideId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body }),
      });
      const data = (await res.json()) as { error?: string; message?: ChatMessagePayload };
      if (!res.ok) {
        setError(data.error ?? 'Message could not be sent.');
        return;
      }
      setMessage('');
      await loadThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const reportMessage = async (messageId: string) => {
    if (!messageId || !thread) return;
    try {
      const res = await fetch(`/api/rides/${rideId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'report', messageId }),
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
      const reference = data.reference ?? `chat-${messageId.slice(0, 8)}`;
      const subject = encodeURIComponent(`Pool chat complaint reference ${reference}`);
      const body = encodeURIComponent(
        `Ride ID: ${rideId}\nMessage reference: ${reference}\nMessage ID: ${messageId}\n\nPlease describe the issue and attach the relevant conversation context.`,
      );
      window.location.href = `mailto:${COMPLAINT_EMAIL}?subject=${subject}&body=${body}`;
      setError(`Complaint reference: ${reference}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The message could not be reported.');
    }
  };

  if (viewerRole === 'visitor') return null;

  return (
    <section aria-labelledby="ride-chat-heading" className="mt-10 rounded-panel border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="ride-chat-heading" className="text-xl font-bold tracking-tight">
          {headerText}
        </h2>
        {thread && !thread.readOnly && (
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">Live</span>
        )}
      </div>

      {!thread && (
        <p className="text-sm text-ink-muted">
          Pool chat opens once the ride locks and only current members can read or post.
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
              {!item.isMine && thread.canWrite && (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-accent-text underline-offset-2 hover:underline"
                  onClick={() => void reportMessage(item.id)}
                >
                  {item.reported ? 'Reported' : 'Report'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showComposer && (
        <form onSubmit={sendMessage} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-ink-muted" htmlFor={`ride-chat-message-${rideId}`}>
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
            <span className="text-xs text-ink-muted">{message.trim().length}/{CHAT_MESSAGE_LIMIT}</span>
            <button
              type="submit"
              disabled={busy || !message.trim()}
              className="rounded-control border border-primary bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      )}

      {thread && thread.readOnly && (
        <p className="mt-3 text-sm text-ink-muted">
          This chat closed 24 hours after the trip ended or was cancelled, and no new messages are
          accepted.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
