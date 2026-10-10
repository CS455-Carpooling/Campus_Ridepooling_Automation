import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SearchRideResult } from '@/lib/ride-search';
import { RideCard } from './RideCard';

const mockRide: SearchRideResult = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  direction: 'to_hub',
  ownerName: 'Rahul Sharma',
  occupantNames: ['Rahul Sharma', 'Priya Patel'],
  hub: { name: 'Kanpur Central', detail: 'Railway station' },
  campusLocationName: 'Hall 6',
  departureStart: '2099-10-10T06:30:00.000Z',
  departureEnd: '2099-10-10T07:30:00.000Z',
  vehicleName: 'Car',
  capacity: 4,
  occupantCount: 2,
  seatsLeft: 2,
  totalFare: 400,
  estimatedShare: 134,
};

describe('RideCard', () => {
  it('renders ride details correctly', () => {
    render(<RideCard ride={mockRide} />);

    expect(screen.getByText('To Kanpur Central')).toBeInTheDocument();
    expect(screen.getByText('Leaving campus')).toBeInTheDocument();
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('and 1 other')).toBeInTheDocument();
    expect(screen.getByText('2 seats left')).toBeInTheDocument();
  });

  it('shows Full badge when no seats are left', () => {
    render(<RideCard ride={{ ...mockRide, seatsLeft: 0 }} />);

    expect(screen.getByText('Full')).toBeInTheDocument();
  });
});
