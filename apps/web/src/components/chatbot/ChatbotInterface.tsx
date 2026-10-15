'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '../ui/Button';
import { DesignSystem } from '../ui/DesignSystem';
import { routes } from '../../lib/routes';
import { formatRupees } from '../../lib/format';
import { directionLabels } from '../../lib/ride-status';
import type { SearchRideResult } from '../../lib/ride-search';
import type { RideFormOptions } from '../../lib/ride-options';
import type { ChatbotResponse, InterpretedFilters } from '../../lib/ai/chatbot';
import type { PreferenceProposal } from '../../lib/ai/preference-proposals';
import type { PublicProfileResult } from '../../lib/ai/chatbot-tools';
import { RideCard } from '../rides/RideCard';

export type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  responsePayload?: ChatbotResponse;
};

import {
  resolveChatbotInitialMessages,
  CHATBOT_STORAGE_PREFIX,
} from '../../lib/ai/chatbot-session';

export const INITIAL_GREETING: ChatMessage = {
  id: 'greeting',
  sender: 'assistant',
  timestamp: new Date().toISOString(),
  text: 'Hi! I am your Campus Ride-Pooling Assistant. I can help you find open rides, check public profiles of drivers and co-riders, or propose updates to your ride preferences.',
};

export function ChatbotInterface({
  userId,
  options,
}: {
  userId: string;
  options: RideFormOptions;
}) {
  const exampleHub = options.hubs[0];
  const exampleCampusPlace = options.campusPlaces[0];
  const exampleVehicle = options.vehicleTypes[0];
  const suggestions = [
    exampleHub && `Find rides to ${exampleHub.name} tomorrow morning`,
    exampleHub &&
      exampleCampusPlace &&
      `Find rides from ${exampleCampusPlace.name} to ${exampleHub.name} tomorrow`,
    exampleCampusPlace && `Propose my default pickup location as ${exampleCampusPlace.name}`,
    exampleVehicle && `Propose ${exampleVehicle.name} as my preferred vehicle`,
    'What can you help me with?',
  ].filter((suggestion): suggestion is string => Boolean(suggestion));

  const storageKey = `${CHATBOT_STORAGE_PREFIX}${userId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    resolveChatbotInitialMessages(storageKey, INITIAL_GREETING),
  );

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messageSequence = useRef(0);
  const conversationRef = useRef<HTMLDivElement>(null);
  const nextMessageId = (prefix: string) => `${prefix}-${++messageSequence.current}`;

  // Sync to tab-local sessionStorage (FR-RD-05.6)
  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages, loading]);

  const clearConversation = () => {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {}
    setMessages([
      {
        ...INITIAL_GREETING,
        id: nextMessageId('greeting'),
        timestamp: new Date().toISOString(),
      },
    ]);
    setErrorMessage(null);
  };

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || loading) return;

    if (text.length > 500) {
      setErrorMessage('Messages cannot exceed 500 characters.');
      return;
    }

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: nextMessageId('user'),
      sender: 'user',
      timestamp: new Date().toISOString(),
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Handle rate limit (429) or service failure (503/504)
        const errorText =
          data?.error ||
          data?.message ||
          'The AI assistant is temporarily unavailable. Please try manual ride search.';
        const assistantMsg: ChatMessage = {
          id: nextMessageId('bot'),
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: errorText,
          responsePayload: data?.kind
            ? data
            : {
                kind: 'service_unavailable',
                message: errorText,
                fallbackLink: { href: routes.findRide, label: 'Manual Ride Search' },
              },
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: nextMessageId('bot'),
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        text: data.message || 'Here is what I found:',
        responsePayload: data,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: nextMessageId('bot'),
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        text: 'Network error or service unavailable. You can use standard manual ride search.',
        responsePayload: {
          kind: 'service_unavailable',
          message:
            'The AI assistant is temporarily unavailable. You can use standard manual ride search.',
          fallbackLink: { href: routes.findRide, label: 'Manual Ride Search' },
        },
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <DesignSystem className="min-w-0">
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 px-3 py-5 sm:gap-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-5 rounded-panel bg-brand p-5 text-on-brand sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:p-10">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-on-brand/20 bg-on-brand/10 px-3 py-1 text-xs font-semibold text-on-brand-muted">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              YOUR CAMPUS, CONNECTED
            </div>
            <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Ride-Pooling Assistant
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-brand-muted sm:text-base">
              Find a ride, learn about public profiles, or update your preferences with a simple
              message.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-48 sm:items-end">
            <span
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-control border border-on-brand/20 px-3 text-xs font-semibold text-on-brand-muted sm:self-auto"
              title="Conversation content is cleared when you reload or sign out."
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path
                  d="M6 8V6a4 4 0 1 1 8 0v2m-9 0h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Private tab session
            </span>
            <Button
              variant="accent"
              onClick={clearConversation}
              className="w-full sm:w-auto"
              aria-label="Clear conversation history"
            >
              Clear Conversation
            </Button>
          </div>
        </header>

        <section aria-labelledby="suggestions-heading" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-text">
                Get started
              </p>
              <h2 id="suggestions-heading" className="mt-1 text-lg font-bold tracking-tight">
                Try asking
              </h2>
            </div>
            <p className="text-xs text-ink-muted">Tap a prompt to send it</p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendMessage(suggestion)}
                disabled={loading}
                className="group flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-control border border-line bg-surface px-4 py-3 text-left text-sm font-semibold text-ink hover:border-accent hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 break-words">{suggestion}</span>
                <span aria-hidden="true" className="shrink-0 text-accent-text">
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                    <path
                      d="M4 10h12m-5-5 5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="conversation-heading"
          className="min-w-0 overflow-hidden rounded-panel border border-line bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
            <div>
              <h2 id="conversation-heading" className="font-bold tracking-tight">
                Conversation
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Ask naturally; you can review and edit ride-search filters.
              </p>
            </div>
            <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </span>
          </div>

          <div
            ref={conversationRef}
            className="flex h-[min(62svh,720px)] min-h-[360px] min-w-0 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6"
            role="log"
            aria-label="Chat conversation"
            aria-live="polite"
            aria-relevant="additions text"
            tabIndex={0}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex min-w-0 flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="mb-1.5 px-1 text-xs font-semibold text-ink-muted">
                  {msg.sender === 'user' ? 'You' : 'Ride-Pooling Assistant'}
                </span>
                {msg.sender === 'assistant' && msg.responsePayload?.aiGenerated && (
                  <span
                    className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-[11px] font-semibold text-accent-text"
                    title="Gemini interpreted this request; trusted server tools provide ride and profile data."
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-text" />
                    {msg.responsePayload.kind === 'assistant_reply'
                      ? 'Gemini answer'
                      : 'Gemini interpreted'}
                  </span>
                )}
                {msg.sender === 'assistant' && msg.responsePayload?.aiFallback && (
                  <span
                    className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-[11px] font-semibold text-ink-muted"
                    title="Gemini did not return a usable response, so deterministic handling was used."
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
                    Basic fallback
                  </span>
                )}
                <div
                  className={`w-fit max-w-[92%] rounded-panel px-4 py-3 text-sm leading-6 sm:max-w-2xl sm:px-5 ${
                    msg.sender === 'user'
                      ? 'rounded-control bg-primary text-on-primary'
                      : 'border border-line bg-panel text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>

                {msg.responsePayload && (
                  <div className="mt-3 w-full max-w-3xl min-w-0">
                    {msg.responsePayload.kind === 'search_results' && (
                      <SearchResultsView
                        filters={msg.responsePayload.interpretedFilters}
                        rides={msg.responsePayload.rides}
                        options={options}
                        compact
                        onReSearch={(newFilters) => {
                          const directionText = newFilters.direction === 'to_hub' ? 'to' : 'from';
                          const vehicle = options.vehicleTypes.find(
                            (v) => v.id === newFilters.vehicleTypeId,
                          );
                          const vehiclePart = vehicle ? ` by ${vehicle.name}` : '';
                          const farePart = newFilters.maxFareShare
                            ? ` under ₹${newFilters.maxFareShare}`
                            : '';
                          sendMessage(
                            `Rides ${directionText} ${newFilters.hubName}${vehiclePart}${farePart}`,
                          );
                        }}
                      />
                    )}

                    {msg.responsePayload.kind === 'public_profile' && (
                      <PublicProfileView profile={msg.responsePayload.profile} />
                    )}

                    {msg.responsePayload.kind === 'preference_proposal' && (
                      <PreferenceProposalCard proposal={msg.responsePayload.proposal} />
                    )}

                    {msg.responsePayload.kind === 'prohibited_action' && (
                      <ProhibitedActionCard
                        actionType={msg.responsePayload.actionType}
                        message={msg.responsePayload.message}
                        targetLink={msg.responsePayload.targetLink}
                      />
                    )}

                    {msg.responsePayload.kind === 'service_unavailable' && (
                      <ServiceUnavailableCard
                        message={msg.responsePayload.message}
                        fallbackLink={msg.responsePayload.fallbackLink}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 self-start rounded-control border border-line bg-panel px-4 py-3 text-sm text-ink-muted">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-text animate-skeleton"
                />
                <span role="status">
                  <span className="block font-semibold text-ink">
                    Understanding your request...
                  </span>
                  <span className="block text-xs">
                    Gemini is interpreting; actions are validated before they run.
                  </span>
                </span>
              </div>
            )}
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="min-w-0 rounded-panel border border-line bg-surface p-3 sm:p-4"
        >
          <label htmlFor="chatbot-message" className="mb-2 block text-sm font-bold text-ink">
            Your message
          </label>
          {errorMessage && (
            <p className="mb-2 text-sm font-semibold text-danger" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              id="chatbot-message"
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Ask about rides, check rider profiles, or propose preference changes..."
              maxLength={500}
              className="min-h-12 min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              aria-label="Message to ride-pooling assistant"
              disabled={loading}
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full sm:w-auto"
              disabled={loading || !input.trim() || input.length > 500}
            >
              Send message
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-ink-muted">
            <span>Search rides, view public profiles, or propose preference changes.</span>
            <span
              aria-live="polite"
              className={input.length > 450 ? 'font-semibold text-danger' : ''}
            >
              {input.length} / 500
            </span>
          </div>
        </form>
      </main>
    </DesignSystem>
  );
}

/**
 * Renders interpreted filters as EDITABLE controls alongside ride results (FR-RD-05.1).
 */
function SearchResultsView({
  filters,
  rides,
  options,
  compact = false,
  onReSearch,
}: {
  filters: InterpretedFilters;
  rides: SearchRideResult[];
  options: RideFormOptions;
  compact?: boolean;
  onReSearch: (updated: InterpretedFilters) => void;
}) {
  const [editable, setEditable] = useState<InterpretedFilters>(filters);
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div
      className={`flex flex-col rounded-panel border border-line-strong bg-surface ${
        compact ? 'gap-3 p-3 sm:p-4' : 'gap-4 p-4 sm:p-5'
      }`}
    >
      {/* Interpreted Filter Header & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-accent-text">
            Interpreted Search Filters (FR-RD-05.1)
          </h2>
          <p className="text-xs text-ink-muted">
            {directionLabels[editable.direction]} {editable.hubName} · {editable.campusLocationName}
            {editable.maxFareShare ? ` · Max share ₹${editable.maxFareShare}` : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          className="text-xs py-1 min-h-8"
          onClick={() => setShowEditor(!showEditor)}
        >
          {showEditor ? 'Hide Filter Editor' : 'Edit Filters'}
        </Button>
      </div>

      {/* Editable Filter Panel */}
      {showEditor && (
        <div className="grid gap-3 rounded-panel border border-line bg-panel p-3 text-xs sm:grid-cols-2">
          <div>
            <label className="font-semibold text-ink">Direction</label>
            <select
              value={editable.direction}
              onChange={(e) =>
                setEditable({
                  ...editable,
                  direction: e.target.value as 'to_hub' | 'from_hub',
                })
              }
              className="mt-1 w-full rounded-control border border-line bg-surface p-1.5"
            >
              <option value="to_hub">To Hub (From Campus)</option>
              <option value="from_hub">From Hub (To Campus)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-ink">Hub</label>
            <select
              value={editable.hubId}
              onChange={(e) => {
                const hub = options.hubs.find((h) => h.id === e.target.value);
                setEditable({
                  ...editable,
                  hubId: e.target.value,
                  hubName: hub?.name ?? editable.hubName,
                });
              }}
              className="mt-1 w-full rounded-control border border-line bg-surface p-1.5"
            >
              {options.hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-ink">Campus Location</label>
            <select
              value={editable.campusLocationId}
              onChange={(e) => {
                const loc = options.campusPlaces.find((l) => l.id === e.target.value);
                setEditable({
                  ...editable,
                  campusLocationId: e.target.value,
                  campusLocationName: loc?.name ?? editable.campusLocationName,
                });
              }}
              className="mt-1 w-full rounded-control border border-line bg-surface p-1.5"
            >
              {options.campusPlaces.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-ink">Max Fare Share (₹)</label>
            <input
              type="number"
              value={editable.maxFareShare ?? ''}
              onChange={(e) =>
                setEditable({
                  ...editable,
                  maxFareShare: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Any fare"
              className="mt-1 w-full rounded-control border border-line bg-surface p-1.5"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button
              variant="primary"
              className="text-xs py-1 min-h-8"
              onClick={() => onReSearch(editable)}
            >
              Update Search
            </Button>
          </div>
        </div>
      )}

      {/* Ride Results */}
      {rides.length === 0 ? (
        <div className="rounded-panel border border-dashed border-line p-6 text-center">
          <p className="font-semibold text-ink">No matching rides found.</p>
          <p className="mt-1 text-xs text-ink-muted">
            Try adjusting your departure window or campus location, or check manual search at{' '}
            <Link href={routes.findRide} className="text-primary underline">
              Find a ride
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-ink-muted">
            Found {rides.length} matching {rides.length === 1 ? 'ride' : 'rides'}:
          </p>
          {rides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              pickupPointId={filters.campusLocationId}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Public profile viewer (FR-RD-05.2, US-RD-13-AC1).
 */
function PublicProfileView({ profile }: { profile: PublicProfileResult }) {
  return (
    <div className="rounded-panel border border-line bg-surface p-4 text-sm">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h3 className="font-bold text-ink">{profile.displayName}</h3>
        <span className="rounded-full bg-panel px-2.5 py-0.5 text-xs text-ink-muted">
          {profile.completedTrips} completed {profile.completedTrips === 1 ? 'trip' : 'trips'}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs">
        <div>
          <span className="font-semibold text-ink-muted">Rating: </span>
          <span className="font-semibold text-ink">
            {profile.aggregateRating
              ? `${profile.aggregateRating.average} average (${profile.aggregateRating.count} reviews)`
              : 'No released ratings yet (minimum 3 required for release)'}
          </span>
        </div>

        {profile.visibleTags.length > 0 && (
          <div>
            <span className="font-semibold text-ink-muted">Public Interests: </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile.visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-control border border-line bg-panel px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-2 text-xs italic text-ink-muted">
          Privacy: Contact details (phone numbers, emails) are protected under FR-RD-05.2. Direct
          contact occurs via verified in-app pool chat once accepted into a ride.
        </p>
      </div>
    </div>
  );
}

/**
 * Preference update proposal card with Before/After diff and explicit confirmation (FR-RD-05.3, AI-RD-04).
 */
function PreferenceProposalCard({ proposal }: { proposal: PreferenceProposal }) {
  const [status, setStatus] = useState<string>(proposal.status);
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const confirmProposal = async () => {
    setConfirming(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/chatbot/confirm-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('expired');
        setFeedback(data.error || 'Failed to confirm preference changes.');
      } else {
        setStatus('confirmed');
        setFeedback('Preferences updated successfully!');
      }
    } catch {
      setFeedback('Network error. Could not confirm changes.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-panel border border-accent bg-surface p-4 text-sm">
      <header className="border-b border-line pb-2">
        <h3 className="font-bold text-ink">Proposed Preference Update</h3>
        <p className="text-xs text-ink-muted">
          Review the changes below. Changes take effect only after explicit confirmation
          (FR-RD-05.3). Unconfirmed proposals lapse after 10 minutes.
        </p>
      </header>

      {/* Before / After Table */}
      <div className="-mx-1 mt-3 overflow-x-auto px-1">
        <table className="w-full min-w-[30rem] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th className="py-1">Preference</th>
              <th className="py-1">Current (Before)</th>
              <th className="py-1">Proposed (After)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {proposal.changes.defaultPickupPointId !== undefined && (
              <tr>
                <td className="py-1 font-semibold">Pickup Point</td>
                <td className="py-1 text-ink-muted">
                  {proposal.before.defaultPickupPoint?.name ?? 'None'}
                </td>
                <td className="py-1 font-semibold text-primary">
                  {proposal.after.defaultPickupPoint?.name ?? 'None'}
                </td>
              </tr>
            )}
            {proposal.changes.preferredVehicleTypeId !== undefined && (
              <tr>
                <td className="py-1 font-semibold">Vehicle Type</td>
                <td className="py-1 text-ink-muted">
                  {proposal.before.preferredVehicleType?.name ?? 'Any'}
                </td>
                <td className="py-1 font-semibold text-primary">
                  {proposal.after.preferredVehicleType?.name ?? 'Any'}
                </td>
              </tr>
            )}
            {proposal.changes.maxAcceptableFareShare !== undefined && (
              <tr>
                <td className="py-1 font-semibold">Max Fare Share</td>
                <td className="py-1 text-ink-muted">
                  {proposal.before.maxAcceptableFareShare
                    ? formatRupees(proposal.before.maxAcceptableFareShare)
                    : 'No limit'}
                </td>
                <td className="py-1 font-semibold text-primary">
                  {proposal.after.maxAcceptableFareShare
                    ? formatRupees(proposal.after.maxAcceptableFareShare)
                    : 'No limit'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {feedback && (
        <p
          className={`mt-3 text-xs font-semibold ${
            status === 'confirmed' ? 'text-primary' : 'text-danger'
          }`}
          role="status"
        >
          {feedback}
        </p>
      )}

      {status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="primary"
            onClick={confirmProposal}
            disabled={confirming}
            className="text-xs py-1.5 min-h-9"
          >
            {confirming ? 'Applying...' : 'Confirm Preference Change'}
          </Button>
        </div>
      )}

      {status === 'confirmed' && (
        <span className="mt-3 inline-block rounded-control bg-panel px-3 py-1 text-xs font-semibold text-primary">
          Changes applied
        </span>
      )}

      {status === 'expired' && (
        <span className="mt-3 inline-block rounded-control bg-panel px-3 py-1 text-xs font-semibold text-danger">
          Lapsed (10-minute expiry passed)
        </span>
      )}
    </div>
  );
}

/**
 * Prohibited Action Redirect Banner (FR-RD-05.4, US-RD-14-AC3).
 */
function ProhibitedActionCard({
  message,
  targetLink,
}: {
  actionType: string;
  message: string;
  targetLink: { href: string; label: string };
}) {
  return (
    <div className="rounded-panel border border-line-strong bg-panel p-4 text-sm">
      <p className="text-ink">{message}</p>
      <div className="mt-3">
        <Link
          href={targetLink.href}
          className="inline-flex min-h-9 items-center justify-center rounded-control border border-primary bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-strong"
        >
          {targetLink.label} →
        </Link>
      </div>
    </div>
  );
}

/**
 * Service Unavailable Fallback Banner (FR-RD-05.7).
 */
function ServiceUnavailableCard({
  message,
  fallbackLink,
}: {
  message: string;
  fallbackLink: { href: string; label: string };
}) {
  return (
    <div className="rounded-panel border border-danger/40 bg-surface p-4 text-sm">
      <p className="font-semibold text-danger">AI Service Notice</p>
      <p className="mt-1 text-xs text-ink-muted">{message}</p>
      <div className="mt-3">
        <Link
          href={fallbackLink.href}
          className="inline-flex min-h-9 items-center justify-center rounded-control border border-line-strong bg-panel px-4 text-xs font-semibold text-ink hover:bg-surface"
        >
          {fallbackLink.label} →
        </Link>
      </div>
    </div>
  );
}
