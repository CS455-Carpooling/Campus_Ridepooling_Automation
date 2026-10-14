import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatbotPage from './page';

const mockUser = { id: 'user-123', email: 'rider@iitk.ac.in' };
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getRideFormOptions: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/ride-options', () => ({ getRideFormOptions: mocks.getRideFormOptions }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

describe('ChatbotPage (/chatbot Route)', () => {
  it('redirects unauthenticated riders to /login', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);

    await expect(ChatbotPage()).rejects.toThrow('NEXT_REDIRECT /login');
  });

  it('renders ChatbotInterface when user is logged in', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(mockUser);
    mocks.getRideFormOptions.mockResolvedValueOnce({
      campusPlaces: [{ id: 'hall-1', name: 'Hall 1' }],
      hubs: [{ id: 'hub-1', name: 'Kanpur Central', detail: null }],
      vehicleTypes: [{ id: 'auto', name: 'Auto', capacity: 3 }],
    });

    const jsx = await ChatbotPage();
    render(jsx);

    expect(screen.getByRole('heading', { name: 'Ride-Pooling Assistant' })).toBeInTheDocument();
  });
});
