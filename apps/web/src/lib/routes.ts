import type { Role } from './roles';

/**
 * Every page the app links to, in one place. Several belong to other tasks and
 * may not exist yet; until they do, their links show the 404 page.
 */
export const routes = {
  landing: '/',
  home: '/dashboard',
  profile: '/profile',
  login: '/login',
  register: '/register',
  terms: '/terms',
  privacy: '/privacy',
  findRide: '/rides',
  offerRide: '/rides/new',
  ride: (rideId: string) => `/rides/${encodeURIComponent(rideId)}`,
  rideReview: (rideId: string) => `/rides/${encodeURIComponent(rideId)}/review`,
  rideComplaint: (rideId: string) => `/rides/${encodeURIComponent(rideId)}/complaint`,
  myComplaints: '/complaints',
  notifications: '/notifications',
  admin: '/admin',
  /** SOS alerts (FR-RD-15) wait for in-trip ride states; nothing links here until then. */
  adminIncidents: '/admin/incidents',
  adminComplaints: '/admin/complaints',
  adminComplaint: (complaintId: string) => `/admin/complaints/${encodeURIComponent(complaintId)}`,
  adminRiders: '/admin/riders',
  adminRider: (userId: string) => `/admin/riders/${encodeURIComponent(userId)}`,
  adminRide: (rideId: string) => `/admin/rides/${encodeURIComponent(rideId)}`,
  adminConfiguration: '/admin/configuration',
  adminVehicleTypes: '/admin/configuration/vehicle-types',
  adminHubs: '/admin/configuration/hubs',
  adminFares: '/admin/configuration/fares',
} as const;

export type NavItem = { href: string; label: string };

const navigation: Record<Role, NavItem[]> = {
  student: [
    { href: routes.home, label: 'Home' },
    { href: routes.profile, label: 'Profile' },
    { href: routes.findRide, label: 'Find a ride' },
    { href: routes.offerRide, label: 'Offer a ride' },
    { href: routes.notifications, label: 'Notifications' },
  ],
  // AI recommendations are decided on each complaint, so they have no entry of their own.
  admin: [
    { href: routes.home, label: 'Home' },
    { href: routes.adminComplaints, label: 'Complaints' },
    { href: routes.adminRiders, label: 'Riders' },
    { href: routes.adminConfiguration, label: 'Configuration' },
    { href: routes.profile, label: 'Profile' },
  ],
};

/** The main navigation for a role. */
export function navigationFor(role: Role): NavItem[] {
  return navigation[role];
}

/**
 * The navigation entry for the current page: the longest href that equals the
 * path or is a parent of it, so /rides/new marks "Offer a ride", not "Find a ride".
 */
export function currentHref(pathname: string | null, items: NavItem[]): string | undefined {
  if (!pathname) return undefined;
  return items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
