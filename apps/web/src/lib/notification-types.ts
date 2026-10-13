export const notificationTypes = [
  'pool_chat_opened',
  'pool_chat_message',
  'ride_update',
  'account_warning',
  'account_suspended',
  'account_reactivated',
  'complaint_update',
  // Join requests (CS455-75).
  'join_request',
  'join_request_update',
  'ride_share_update',
  // A trip under way (CS455-60).
  'trip_update',
  'no_show_recorded',
] as const;

export type NotificationType = (typeof notificationTypes)[number];
