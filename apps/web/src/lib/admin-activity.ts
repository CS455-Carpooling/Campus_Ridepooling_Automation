/**
 * How the admin pages name what is in the audit log (`admin_audit_log`, CS455-47). Every
 * state-changing admin route passes one of these action codes to withAdminAction()
 * (CS455-48), so the history reads the same everywhere. Pure, for server and client.
 */
export const adminActionLabels = {
  'role.grant': 'Made an operations admin',
  'role.revoke': 'Removed admin access',
  'vehicle_type.create': 'Added a vehicle type',
  'vehicle_type.update': 'Changed a vehicle type',
  'location.create': 'Added a place',
  'location.update': 'Changed a place',
  'campus_fare.set': 'Set a campus fare',
  'external_fare.set': 'Set a fare range',
  'complaint.status': 'Changed a complaint status',
  'rider.warn': 'Warned a rider',
  'rider.suspend': 'Suspended a rider',
  'rider.reactivate': 'Lifted a suspension',
  'ai.decide': 'Decided on an AI recommendation',
} as const;

export type AdminAction = keyof typeof adminActionLabels;

/** The label of an action; an action without one shows its code rather than nothing. */
export function adminActionLabel(action: string): string {
  return Object.hasOwn(adminActionLabels, action)
    ? adminActionLabels[action as AdminAction]
    : action;
}

/** Each attempt is audited with its outcome, and the pages keep the three apart (SYS-NFR-12). */
export const adminOutcomeLabels = {
  succeeded: 'Done',
  refused: 'Refused',
  failed: 'Failed',
} as const;

export type AdminOutcome = keyof typeof adminOutcomeLabels;

export type AdminActor = 'admin' | 'operator_script' | 'system';

/** Who made a change: the admin by name, or the operator's script, or the system itself. */
export function adminActorLabel(actor: AdminActor, adminName: string | null): string {
  if (actor === 'operator_script') return 'Operator script';
  if (actor === 'system') return 'System';
  return adminName ?? 'An admin';
}
