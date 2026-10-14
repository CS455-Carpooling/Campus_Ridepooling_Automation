'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '../ui/Button';
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

const SUGGESTIONS = [
  'Rides to Kanpur Central tomorrow morning',
  'Find cabs to Lucknow airport under ₹300',
  'Who is Alex?',
  'Change my default pickup location to Hall 7',
  'Can you book me a seat in ride #1?',
];

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
  const storageKey = `${CHATBOT_STORAGE_PREFIX}${userId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    resolveChatbotInitialMessages(storageKey, INITIAL_GREETING),
  );

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messageSequence = useRef(0);
  const nextMessageId = (prefix: string) => `${prefix}-${++messageSequence.current}`;

  // Sync to tab-local sessionStorage (FR-RD-05.6)
  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

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
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      {/* Header bar with Session Privacy notice and Clear button (FR-RD-05.6) */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Ride-Pooling Assistant
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Search with natural language, view public profiles, or adjust preferences.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="hidden text-xs text-ink-muted sm:inline-block"
            title="Conversation is stored only in this tab's memory and is discarded on tab closure or sign-out (FR-RD-05.6)."
          >
            Tab-local session
          </span>
          <Button
            variant="secondary"
            onClick={clearConversation}
            className="text-sm"
            aria-label="Clear conversation history"
          >
            Clear Conversation
          </Button>
        </div>
      </header>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => sendMessage(suggestion)}
            className="rounded-full border border-line-strong bg-panel px-3 py-1 text-xs font-medium text-ink hover:border-primary hover:text-primary"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div
        className="flex min-h-[400px] flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-6"
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-panel p-4 text-sm ${
                msg.sender === 'user'
                  ? 'bg-primary text-on-primary'
                  : 'border border-line bg-panel text-ink'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>

            {/* Structured Response Payload rendering */}
            {msg.responsePayload && (
              <div className="mt-3 w-full max-w-2xl">
                {msg.responsePayload.kind === 'search_results' && (
                  <SearchResultsView
                    filters={msg.responsePayload.interpretedFilters}
                    rides={msg.responsePayload.rides}
                    options={options}
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
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {/* Input Form with 500-Character Counter (AI-RD-09, FR-RD-05.4) */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {errorMessage && (
          <p className="text-sm font-semibold text-danger" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Ask about rides, check rider profiles, or propose preference changes..."
            maxLength={500}
            className="flex-1 rounded-control border border-line-strong bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            aria-label="Message to ride-pooling assistant"
            disabled={loading}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !input.trim() || input.length > 500}
          >
            Send
          </Button>
        </div>
        <div className="flex justify-between px-1 text-xs text-ink-muted">
          <span>Supported: ride search, public profile queries, preference proposals</span>
          <span className={input.length > 450 ? 'font-semibold text-danger' : ''}>
            {input.length} / 500
          </span>
        </div>
      </form>
    </div>
  );
}

/**
 * Renders interpreted filters as EDITABLE controls alongside ride results (FR-RD-05.1).
 */
function SearchResultsView({
  filters,
  rides,
  options,
  onReSearch,
}: {
  filters: InterpretedFilters;
  rides: SearchRideResult[];
  options: RideFormOptions;
  onReSearch: (updated: InterpretedFilters) => void;
}) {
  const [editable, setEditable] = useState<InterpretedFilters>(filters);
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-panel border border-line-strong bg-surface p-4 sm:p-5">
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
            <RideCard key={ride.id} ride={ride} pickupPointId={filters.campusLocationId} />
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
              ? `★ ${profile.aggregateRating.average} (${profile.aggregateRating.count} reviews)`
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
      <table className="mt-3 w-full text-left text-xs">
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
