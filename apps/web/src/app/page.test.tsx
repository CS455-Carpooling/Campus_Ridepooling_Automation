import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';
import LandingPage from './page';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session | null>>(),
}));
vi.mock('@/lib/session', () => ({ getSession }));

const student: Session = {
  userId: 'u1',
  email: 'ananya@example.org',
  displayName: 'Ananya',
  role: 'student',
};

async function renderLanding(session: Session | null) {
  getSession.mockResolvedValue(session);
  render(await LandingPage());
}

describe('LandingPage', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it('states what the service does in one top-level heading', async () => {
    await renderLanding(null);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Share the ride. Split the fare.' }),
    ).toBeInTheDocument();
  });

  it('offers registration and sign-in to visitors', async () => {
    await renderLanding(null);
    const register = screen.getAllByRole('link', { name: 'Register' });
    expect(register).toHaveLength(2);
    for (const link of register) expect(link).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: 'Go to your rides' })).not.toBeInTheDocument();
  });

  it('sends signed-in students to their rides instead', async () => {
    await renderLanding(student);
    const toRides = screen.getAllByRole('link', { name: 'Go to your rides' });
    expect(toRides).toHaveLength(2);
    for (const link of toRides) expect(link).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.getByText('Find a ride or offer one from your dashboard.')).toBeInTheDocument();
  });

  it('includes the live fare split on an example ride', async () => {
    await renderLanding(null);
    const card = screen.getByRole('region', { name: 'Try the fare split' });
    expect(within(card).getByText('Example ride')).toBeInTheDocument();
    expect(within(card).getByText(/From Hall 6 to Kanpur Central/)).toBeInTheDocument();
    expect(within(card).getByRole('form', { name: 'Fare split' })).toBeInTheDocument();
    expect(within(card).getByLabelText('Total fare (₹)')).toHaveValue('350');
  });

  it('lists the destination hubs of SYS-FR-09', async () => {
    await renderLanding(null);
    const section = screen.getByRole('region', {
      name: 'From your hall to the station or airport',
    });
    for (const hub of [
      'Kanpur Central',
      'Kanpur Anwarganj',
      'Bus station',
      'Metro station',
      'Kanpur airport',
      'Lucknow airport',
    ]) {
      expect(within(section).getByText(hub)).toBeInTheDocument();
    }
    expect(within(section).getByText(/fourteen halls or Main Gate/)).toBeInTheDocument();
  });

  it('walks through a ride in order, from registering to paying', async () => {
    await renderLanding(null);
    const section = screen.getByRole('region', { name: 'How a ride works' });
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'Register with your IITK email',
      'Find a ride, or offer your own',
      'The ride locks',
      'Pay the owner and rate the ride',
    ]);
  });

  it('explains SOS, including that it does not replace calling 112', async () => {
    await renderLanding(null);
    const section = screen.getByRole('region', { name: 'Safety and privacy' });
    expect(within(section).getByRole('heading', { name: 'SOS during a trip' })).toBeInTheDocument();
    expect(within(section).getByText(/In an emergency, call 112\./)).toBeInTheDocument();
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(5);
  });
});
