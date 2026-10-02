/**
 * Account roles. As in the D0 proposal, one student account both finds rides
 * (as a rider) and offers rides (as a ride owner); operations admins are
 * separate accounts that are given the admin role.
 */
export type Role = 'student' | 'admin';

export const roleLabels: Record<Role, string> = {
  student: 'Student',
  admin: 'Operations admin',
};
