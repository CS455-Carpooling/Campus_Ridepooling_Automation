'use client';

import { useState } from 'react';
import type { RideRecommendationResponse, RecommendationFactor } from '@/lib/ai/types';
import type { SearchRideRequest } from '@/lib/ride-search';
import { RideCard } from './RideCard';

const FACTOR_LABELS: Record<RecommendationFactor, string> = {
  fare: 'Estimated fare share',
  departure: 'Departure window',
  pickup_order: 'Pickup order',
  shared_interests: 'Shared interests',
  aggregate_rating: 'Aggregate rating',
  vehicle: 'Vehicle type',
  seats: 'Available seats',
  trust_indicator: 'Trust indicator',
};

export function AskAiRecommendations({ filters }: { filters: SearchRideRequest }) {
  const [result, setResult] = useState<RideRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, string>>({});

  async function submitFeedback(rideId: string, value: 'helpful' | 'not_helpful') {
    if (!result?.requestId) return;
    setFeedbackStatus((old) => ({ ...old, [rideId]: 'Saving…' }));
    try {
      const response = await fetch('/api/rides/recommendations/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: result.requestId, rideId, value }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Could not save feedback.');
      setFeedbackStatus((old) => ({ ...old, [rideId]: 'Thanks for your feedback.' }));
    } catch (e) {
      setFeedbackStatus((old) => ({ ...old, [rideId]: e instanceof Error ? e.message : 'Could not save feedback.' }));
    }
  }

  async function suggest() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/rides/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body &&
          typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : 'Could not get suggestions. Please try again.';
        throw new Error(message);
      }
      setResult(body as RideRecommendationResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-panel border border-line-strong bg-panel p-5 sm:p-6" aria-labelledby="ai-suggest-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">Personalised ranking</p>
          <h2 id="ai-suggest-heading" className="mt-1 text-xl font-bold">Ask AI to Suggest</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Get up to five eligible rides ranked by fare, timing, seats and available route or preference signals.
          </p>
        </div>
        <button
          type="button"
          onClick={suggest}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-5 font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Finding suggestions…' : result ? 'Suggest again' : 'Ask AI to Suggest'}
        </button>
      </div>

      {loading && (
        <p className="mt-5 rounded-control border border-line px-4 py-3 text-sm" role="status" aria-live="polite">
          Ranking eligible rides. This can take a few seconds…
        </p>
      )}
      {error && (
        <div className="mt-5 rounded-control border border-danger px-4 py-3 text-sm" role="alert">
          <p>{error}</p>
          <button type="button" className="mt-2 font-semibold underline" onClick={suggest}>Try again</button>
        </div>
      )}

      {result && !loading && (
        <div className="mt-6">
          {result.source === 'fallback' && (
            <p className="mb-4 rounded-control border border-line px-4 py-3 text-sm" role="status">
              {result.message ?? 'AI ranking is unavailable. Showing eligible rides in the default order.'}
            </p>
          )}
          {result.suggestions.length === 0 ? (
            <div className="rounded-control border border-line px-4 py-5">
              <h3 className="font-semibold">No eligible rides found</h3>
              <p className="mt-1 text-sm text-ink-muted">Try widening your departure window or changing an optional filter.</p>
            </div>
          ) : (
            <ol className="flex flex-col gap-6" aria-label="AI ride recommendations">
              {result.suggestions.slice(0, 5).map((suggestion, index) => (
                <li key={suggestion.ride.id} className="rounded-panel border border-line-strong bg-surface p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-bold">Recommendation {index + 1}</h3>
                    {result.source === 'ai' && <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">AI ranked</span>}
                  </div>
                  {/* RideCard renders only trusted SearchRideResult fields from the server. */}
                  <RideCard ride={suggestion.ride} />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-semibold">Why it may suit you</h4>
                      {suggestion.pros.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                          {suggestion.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-ink-muted">No explanation available.</p>}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Trade-offs</h4>
                      {suggestion.cons.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                          {suggestion.cons.map((con, i) => <li key={i}>{con}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-ink-muted">No trade-offs provided.</p>}
                    </div>
                  </div>
                  {result.requestId && (
                    <div className="mt-4 border-t border-line pt-3">
                      <p className="text-sm font-semibold">Was this recommendation helpful?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="rounded-control border border-line px-3 py-2 text-sm" onClick={() => submitFeedback(suggestion.ride.id, 'helpful')} disabled={Boolean(feedbackStatus[suggestion.ride.id]?.startsWith('Thanks'))}>Helpful</button>
                        <button type="button" className="rounded-control border border-line px-3 py-2 text-sm" onClick={() => submitFeedback(suggestion.ride.id, 'not_helpful')} disabled={Boolean(feedbackStatus[suggestion.ride.id]?.startsWith('Thanks'))}>Not helpful</button>
                      </div>
                      {feedbackStatus[suggestion.ride.id] && <p className="mt-2 text-xs text-ink-muted" role="status">{feedbackStatus[suggestion.ride.id]}</p>}
                    </div>
                  )}
                  {suggestion.factors.length > 0 && (
                    <div className="mt-4 border-t border-line pt-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Factors considered</h4>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {suggestion.factors.map((factor) => (
                          <li key={factor} className="rounded-control border border-line px-2.5 py-1 text-xs">
                            {FACTOR_LABELS[factor]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
