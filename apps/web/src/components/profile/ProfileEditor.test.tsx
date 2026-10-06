import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileData } from '@/lib/profile-types';
import { ProfileEditor } from './ProfileEditor';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const profile: ProfileData = {
  email: 'rider@iitk.ac.in',
  fullName: 'Rider Name',
  rollNumber: '220123',
  displayName: 'Rider',
  defaultPickupPointId: 'hall-3',
  preferredVehicleTypeId: null,
  maxAcceptableFareShare: null,
  aiTagConsent: false,
  mobileNumber: null,
  locations: [{ id: 'hall-3', name: 'Hall 3' }],
  vehicles: [{ id: 'car', name: 'Car' }],
  tags: [{ id: 'quiet-ride', name: 'Quiet ride', selected: false, visible: true }],
  completedTrips: 2,
  rating: null,
};

beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({ matches: false })),
  );
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
});

describe('ProfileEditor', () => {
  it('shows private account fields, public preview, and opt-in AI consent', () => {
    render(<ProfileEditor profile={profile} />);
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('IITK email')).toHaveValue('rider@iitk.ac.in');
    expect(screen.getByLabelText('IITK email')).toHaveAttribute('readonly');
    expect(screen.getByText(/2 completed trips/)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Allow my interest tags to inform AI suggestions/ }),
    ).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('selects new tags as visible by default and saves preferences', async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} />);

    await user.click(screen.getByRole('checkbox', { name: 'Quiet ride' }));
    expect(screen.getByRole('checkbox', { name: 'Show this tag to other riders' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"visible":true'),
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
  });
});
