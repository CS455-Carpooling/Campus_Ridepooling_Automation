import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatbotInterface } from './ChatbotInterface';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const mockOptions = {
  campusPlaces: [
    { id: 'hall-6', name: 'Hall 6' },
    { id: 'hall-3', name: 'Hall 3' },
  ],
  hubs: [{ id: 'kanpur-central', name: 'Kanpur Central', detail: 'Station' }],
  vehicleTypes: [
    { id: 'auto', name: 'Auto', capacity: 3 },
    { id: 'car', name: 'Car', capacity: 4 },
  ],
};

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('ChatbotInterface (FR-RD-05, UI & Session Isolation)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders initial welcome state and character counter', () => {
    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    expect(screen.getByText('Campus AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask about rides, drivers/i)).toBeInTheDocument();
  });

  it('enforces tab-local sessionStorage isolation and Clear action (FR-RD-05.6)', async () => {
    const user = userEvent.setup();
    const sessionKey = `crp_chatbot_session_${USER_ID}`;

    // Seed mock session
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify([
        {
          id: 'msg-1',
          role: 'user',
          text: 'Find rides to station tomorrow',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'bot',
          text: 'Found 1 ride matching your query.',
          timestamp: new Date().toISOString(),
        },
      ]),
    );

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    expect(screen.getByText('Find rides to station tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Found 1 ride matching your query.')).toBeInTheDocument();

    // Click "Clear Conversation"
    const clearButton = screen.getByRole('button', { name: /clear conversation/i });
    await user.click(clearButton);

    expect(screen.queryByText('Find rides to station tomorrow')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it('displays service-unavailable banner and links to manual search on 503 (FR-RD-05.7)', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        error: 'AI service temporarily unavailable',
        serviceUnavailable: true,
      }),
    });

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    const input = screen.getByPlaceholderText(/Ask about rides, drivers/i);
    await user.type(input, 'Any ride to Kanpur Central?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/AI service is temporarily unavailable/i)).toBeInTheDocument();
    });

    const manualLink = screen.getByRole('link', { name: /go to manual ride search/i });
    expect(manualLink).toHaveAttribute('href', '/rides');
  });

  it('renders prohibited action guidance and direct navigation links (FR-RD-05.4)', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        botResponse: {
          text: 'I cannot submit a join request for you.',
          actionLink: {
            title: 'Browse and Join Rides',
            href: '/rides',
            description: 'You can review ride details and submit your join request here.',
          },
        },
      }),
    });

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    const input = screen.getByPlaceholderText(/Ask about rides, drivers/i);
    await user.type(input, 'Please join ride 123 for me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('I cannot submit a join request for you.')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: /browse and join rides/i });
    expect(link).toHaveAttribute('href', '/rides');
  });

  it('renders interpreted search filters and allows editing them (FR-RD-05.1)', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        botResponse: {
          text: 'Here are matching rides leaving campus.',
          interpretedFilters: {
            direction: 'to_hub',
            hubId: 'kanpur-central',
            hubName: 'Kanpur Central',
            campusLocationId: 'hall-6',
            campusLocationName: 'Hall 6',
            departureStart: '2026-10-15T08:00',
            departureEnd: '2026-10-15T09:00',
          },
          matchingRides: [],
        },
      }),
    });

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    const input = screen.getByPlaceholderText(/Ask about rides, drivers/i);
    await user.type(input, 'Need a ride to Kanpur Central tomorrow 8am');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Interpreted Search Filters/i)).toBeInTheDocument();
      expect(screen.getByText(/No matching open rides found/i)).toBeInTheDocument();
    });

    // Check that editable controls exist and "Update Search" button is present
    expect(screen.getByRole('button', { name: /update search/i })).toBeInTheDocument();
  });
});
