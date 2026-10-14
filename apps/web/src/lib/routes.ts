import type { Role } from './roles';

/**
 * Every page the app links to, in one place. Several belong to other tasks and
 * may not exist yet; until they do, their links show the 404 page.
 */
export const routes = {
  landing: '/',
  home: '/dashboard',
  profile: '/profile',
  warnings: '/warnings',
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
  /** SOS alerts raised during trips (CS455-65, FR-RD-15). */
  adminIncidents: '/admin/incidents',
  adminIncident: (incidentId: string) => `/admin/incidents/${encodeURIComponent(incidentId)}`,
  adminComplaints: '/admin/complaints',
  adminComplaint: (complaintId: string) => `/admin/complaints/${encodeURIComponent(complaintId)}`,
  adminAiDecisions: '/admin/ai-decisions',
  adminAiRecommendations: '/admin/ai-recommendations',
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
  // Recommendations are decided on their complaint; the separate page preserves decision history.
  admin: [
    { href: routes.home, label: 'Home' },
    { href: routes.adminIncidents, label: 'SOS incidents' },
    { href: routes.adminComplaints, label: 'Complaints' },
    { href: routes.adminAiDecisions, label: 'AI decisions' },
    { href: routes.adminAiRecommendations, label: 'AI recommendations' },
    { href: routes.adminRiders, label: 'Riders' },
    { href: routes.adminConfiguration, label: 'Configuration' },
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
