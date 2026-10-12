export const notificationTypes = [
  'pool_chat_opened',
  'pool_chat_message',
  'ride_update',
  'account_warning',
  'account_suspended',
  'account_reactivated',
  'complaint_update',
] as const;

export type NotificationType = (typeof notificationTypes)[number];
