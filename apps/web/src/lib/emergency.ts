/**
 * The emergency contacts shown with a Safety complaint (FR-RD-13.6) and, later, on the SOS
 * screen (FR-RD-15.3). The campus number is the contact supplied for this deployment.
 */
export const EMERGENCY_CONTACTS = {
  national: { label: 'National emergency number', number: '112' },
  campusSecurity: { label: 'IIT Kanpur security', number: '0512-259-7999' },
} as const;

/** Said with the contacts, because the platform itself sends no help (FR-RD-15.3). */
export const NO_DISPATCH_NOTE =
  'Campus Ride-Pooling does not contact emergency services for you. If you are in danger now, call them yourself.';
