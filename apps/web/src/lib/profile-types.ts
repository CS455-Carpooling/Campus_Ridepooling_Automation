import type { OwnRating } from './rating-rules';

export type ProfileTag = {
  id: string;
  name: string;
  selected: boolean;
  visible: boolean;
};

export type ProfileData = {
  email: string;
  fullName: string;
  rollNumber: string;
  displayName: string;
  defaultPickupPointId: string | null;
  preferredVehicleTypeId: string | null;
  maxAcceptableFareShare: number | null;
  aiTagConsent: boolean;
  mobileNumber: string | null;
  locations: Array<{ id: string; name: string }>;
  vehicles: Array<{ id: string; name: string }>;
  tags: ProfileTag[];
  completedTrips: number;
  /** Released ratings, and from 3 up the average and comments (CS455-44). */
  rating: OwnRating;
};
