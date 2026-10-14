import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AskAiRecommendations } from './AskAiRecommendations';
import type { SearchRideRequest, SearchRideResult } from '@/lib/ride-search';
import type { RideRecommendationResponse } from '@/lib/ai/types';

vi.mock('./RideCard', () => ({
  RideCard: ({ ride, pickupPointId }: { ride: SearchRideResult; pickupPointId: string }) => (
    <div data-testid="trusted-ride" data-pickup-point-id={pickupPointId}>
      {ride.id}|{ride.estimatedShare}|{ride.seatsLeft}|{ride.vehicleName}
    </div>
  ),
}));

const filters: SearchRideRequest = {
  direction: 'to_hub',
  hubId: 'hub-1',
  campusLocationId: 'hall-3',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
};

const ride: SearchRideResult = {
  id: 'ride-1',
  direction: 'to_hub',
  ownerName: 'Trusted owner',
  occupantNames: ['Trusted owner'],
  hub: { name: 'Kanpur Central', detail: 'Railway station' },
  campusLocationName: 'Hall 3',
  departureStart: '2099-10-10T06:40:00+05:30',
  departureEnd: '2099-10-10T07:10:00+05:30',
  vehicleName: 'Auto',
  capacity: 3,
  occupantCount: 1,
  seatsLeft: 2,
  totalFare: 300,
  estimatedShare: 150,
  requestState: null,
};

const response: RideRecommendationResponse = {
  source: 'ai',
  suggestions: [
    {
      ride,
      pros: ['Estimated share fits the selected budget'],
      cons: ['Departure is near the end of your window'],
      factors: ['fare', 'departure', 'seats'],
    },
  ],
};

describe('AskAiRecommendations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows loading and then trusted ride details with explanations', async () => {
    let resolveFetch!: (value: Response) => void;

    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(<AskAiRecommendations filters={filters} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI to Suggest' }));
    expect(screen.getByRole('status')).toHaveTextContent('Ranking eligible rides');

    resolveFetch(new Response(JSON.stringify(response), { status: 200 }));

    await screen.findByText('Estimated share fits the selected budget');

    expect(screen.getByTestId('trusted-ride')).toHaveTextContent('ride-1|150|2|Auto');
    expect(screen.getByTestId('trusted-ride')).toHaveAttribute('data-pickup-point-id', 'hall-3');
    expect(screen.getByText('Departure is near the end of your window')).toBeInTheDocument();
    expect(screen.getByText('Available seats')).toBeInTheDocument();
  });

  it('shows empty and fallback states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            source: 'fallback',
            suggestions: [],
            message: 'No eligible rides match these filters.',
          }),
          { status: 200 },
        ),
      ),
    );

    render(<AskAiRecommendations filters={filters} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI to Suggest' }));

    await screen.findByText('No eligible rides found');

    expect(screen.getByText('No eligible rides match these filters.')).toBeInTheDocument();
  });

  it('shows a retryable error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 })),
    );

    render(<AskAiRecommendations filters={filters} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI to Suggest' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unavailable'));

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it.each([
    { reason: 'wrong', label: 'Wrong recommendation' },
    { reason: 'inappropriate', label: 'Inappropriate recommendation' },
  ])(
    'submits an AI-RD-15 $reason report with its matching request ID',
    async ({ reason, label }) => {
      const reportResponse = { ...response, requestId: 'request-123' };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(reportResponse), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }));
      vi.stubGlobal('fetch', fetchMock);

      render(<AskAiRecommendations filters={filters} />);
      fireEvent.click(screen.getByRole('button', { name: 'Ask AI to Suggest' }));
      await screen.findByRole('button', { name: label });
      fireEvent.click(screen.getByRole('button', { name: label }));

      await screen.findByText('Report sent to the operations team.');
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/rides/recommendations/report',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            requestId: 'request-123',
            rideId: ride.id,
            reason,
          }),
        }),
      );
      expect(screen.getByRole('button', { name: 'Helpful' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Not helpful' })).toBeInTheDocument();
    },
  );

  it('keeps helpful/not-helpful feedback on its original endpoint and request ID', async () => {
    const feedbackResponse = { ...response, requestId: 'request-456' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(feedbackResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AskAiRecommendations filters={filters} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI to Suggest' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Not helpful' }));

    await screen.findByText('Thanks for your feedback.');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/rides/recommendations/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          requestId: 'request-456',
          rideId: ride.id,
          value: 'not_helpful',
        }),
      }),
    );
  });
});
