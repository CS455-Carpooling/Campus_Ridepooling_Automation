import type { Role } from './roles';

/**
 * Every page the app links to, in one place. Several belong to other tasks and
 * may not exist yet; until they do, their links show the 404 page.
 */
export const routes = {
  landing: '/',
  home: '/home',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  terms: '/terms',
  privacy: '/privacy',
  findRide: '/rides',
  offerRide: '/rides/new',
  ride: (rideId: string) => `/rides/${encodeURIComponent(rideId)}`,
  notifications: '/notifications',
  adminIncidents: '/admin/incidents',
  adminComplaints: '/admin/complaints',
  adminRecommendations: '/admin/recommendations',
  adminConfiguration: '/admin/configuration',
  adminVehicleTypes: '/admin/configuration/vehicle-types',
  adminHubs: '/admin/configuration/hubs',
  adminFares: '/admin/configuration/fares',
} as const;

export type NavItem = { href: string; label: string };

const navigation: Record<Role, NavItem[]> = {
  student: [
    { href: routes.home, label: 'Home' },
    { href: routes.findRide, label: 'Find a ride' },
    { href: routes.offerRide, label: 'Offer a ride' },
    { href: routes.notifications, label: 'Notifications' },
  ],
  admin: [
    { href: routes.home, label: 'Home' },
    { href: routes.adminIncidents, label: 'Incidents' },
    { href: routes.adminComplaints, label: 'Complaints' },
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
