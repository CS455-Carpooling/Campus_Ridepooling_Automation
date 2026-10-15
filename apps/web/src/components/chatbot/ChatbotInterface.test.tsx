import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatbotInterface } from './ChatbotInterface';
import { clearChatbotStorage } from '../ui/LogoutButton';

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

    expect(screen.getByRole('heading', { name: 'Ride-Pooling Assistant' })).toBeInTheDocument();
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Ask about rides, check rider profiles/i),
    ).toBeInTheDocument();
  });

  it('offers only supported prompts using currently configured options', () => {
    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    expect(
      screen.getByRole('button', { name: 'Find rides to Kanpur Central tomorrow morning' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Find rides from Hall 6 to Kanpur Central tomorrow',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Propose my default pickup location as Hall 6' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Propose Auto as my preferred vehicle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What can you help me with?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /book me a seat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Who is Alex?' })).not.toBeInTheDocument();
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
    const storedMessages = JSON.parse(sessionStorage.getItem(sessionKey) ?? '[]');
    expect(storedMessages).toHaveLength(1);
    expect(storedMessages[0].sender).toBe('assistant');
    expect(storedMessages[0].text).toMatch(/Hi! I am your Campus Ride-Pooling Assistant/);
  });

  it('discards conversation content on page reload (FR-RD-05.6)', () => {
    const sessionKey = `crp_chatbot_session_${USER_ID}`;
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify([
        {
          id: 'msg-prev',
          sender: 'user',
          text: 'Rides to airport on Friday',
          timestamp: new Date().toISOString(),
        },
      ]),
    );

    // Mock navigation reload
    const originalGetEntries = window.performance.getEntriesByType;
    window.performance.getEntriesByType = vi.fn().mockReturnValue([{ type: 'reload' }]);

    try {
      render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

      // Content from before the reload must be discarded
      expect(screen.queryByText('Rides to airport on Friday')).not.toBeInTheDocument();
      // Previous messages must be purged; the initial greeting may be saved.
      const storedMessages = JSON.parse(sessionStorage.getItem(sessionKey) ?? '[]');
      expect(storedMessages).toHaveLength(1);
      expect(storedMessages[0].sender).toBe('assistant');
      // Initial greeting must be displayed
      expect(screen.getByText(/Hi! I am your Campus Ride-Pooling Assistant/i)).toBeInTheDocument();
    } finally {
      window.performance.getEntriesByType = originalGetEntries;
    }
  });

  it('discards conversation content on rider sign-out via clearChatbotStorage (FR-RD-05.6)', () => {
    const sessionKey1 = `crp_chatbot_session_${USER_ID}`;
    const sessionKey2 = `crp_chatbot_session_22222222-2222-4222-8222-222222222222`;
    const unrelatedKey = 'crp_unrelated_key';

    sessionStorage.setItem(sessionKey1, JSON.stringify([{ id: '1', text: 'Chat 1' }]));
    sessionStorage.setItem(sessionKey2, JSON.stringify([{ id: '2', text: 'Chat 2' }]));
    sessionStorage.setItem(unrelatedKey, 'preserved_value');

    // Sign out executes clearChatbotStorage
    clearChatbotStorage();

    expect(sessionStorage.getItem(sessionKey1)).toBeNull();
    expect(sessionStorage.getItem(sessionKey2)).toBeNull();
    expect(sessionStorage.getItem(unrelatedKey)).toBe('preserved_value');
  });

  it('labels generated replies and deterministic fallback responses', async () => {
    const user = userEvent.setup();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          kind: 'assistant_reply',
          message: 'I can help you find rides.',
          aiGenerated: true,
          aiFallback: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          kind: 'search_results',
          message: 'Showing matching rides.',
          aiGenerated: false,
          aiFallback: true,
          interpretedFilters: {
            direction: 'to_hub',
            hubId: 'kanpur-central',
            hubName: 'Kanpur Central',
            campusLocationId: 'hall-6',
            campusLocationName: 'Hall 6',
            departureStart: '2026-10-15T08:00',
            departureEnd: '2026-10-15T09:00',
          },
          rides: [],
        }),
      });

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);
    const input = screen.getByPlaceholderText(/Ask about rides, check rider profiles/i);

    await user.type(input, 'What can you help me do?');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText('Gemini answer')).toBeInTheDocument();
      expect(screen.getByText('I can help you find rides.')).toBeInTheDocument();
    });

    await user.type(input, 'Find a ride to Kanpur Central tomorrow');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText('Basic fallback')).toBeInTheDocument();
    });
  });

  it('shows an accessible progress state while waiting for the assistant', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    await user.type(
      screen.getByPlaceholderText(/Ask about rides, check rider profiles/i),
      'Find a ride tomorrow',
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Understanding your request...');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Gemini is interpreting; actions are validated before they run.',
    );
  });

  it('displays service-unavailable banner and links to manual search on 503 (FR-RD-05.7)', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        error: 'AI service temporarily unavailable',
      }),
    });

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    const input = screen.getByPlaceholderText(/Ask about rides, check rider profiles/i);
    await user.type(input, 'Any ride to Kanpur Central?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/AI service temporarily unavailable/i)).toHaveLength(2);
    });

    const manualLink = screen.getByRole('link', { name: /manual ride search/i });
    expect(manualLink).toHaveAttribute('href', '/rides');
  });

  it('renders prohibited action guidance and direct navigation links (FR-RD-05.4)', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        kind: 'prohibited_action',
        actionType: 'join',
        message: 'I cannot submit a join request for you.',
        targetLink: { href: '/rides', label: 'Browse and Join Rides' },
      }),
    });

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    const input = screen.getByPlaceholderText(/Ask about rides, check rider profiles/i);
    await user.type(input, 'Please join ride 123 for me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getAllByText('I cannot submit a join request for you.')).toHaveLength(2);
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
        kind: 'search_results',
        message: 'Here are matching rides leaving campus.',
        interpretedFilters: {
          direction: 'to_hub',
          hubId: 'kanpur-central',
          hubName: 'Kanpur Central',
          campusLocationId: 'hall-6',
          campusLocationName: 'Hall 6',
          departureStart: '2026-10-15T08:00',
          departureEnd: '2026-10-15T09:00',
        },
        rides: [],
      }),
    });

    render(<ChatbotInterface userId={USER_ID} options={mockOptions} />);

    const input = screen.getByPlaceholderText(/Ask about rides, check rider profiles/i);
    fireEvent.change(input, {
      target: { value: 'Need a ride to Kanpur Central tomorrow 8am' },
    });
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Interpreted Search Filters/i)).toBeInTheDocument();
      expect(screen.getByText(/No matching rides found/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit filters/i }));
    expect(screen.getByRole('button', { name: /update search/i })).toBeInTheDocument();
  });
});
