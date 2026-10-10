/**
 * The shapes the admin pages and the admin APIs exchange (CS455-46), agreed up front so the
 * pages and the APIs can be built at the same time. Request bodies are checked by
 * admin-config-rules.ts and complaint-rules.ts; these are the answers.
 */
import type { ComplaintCategory, ComplaintSource, ComplaintStatus } from './complaint-rules';
import type { LocationType } from './admin-config-rules';

/** Every refusal: a message for the person, a code for the program, and per-field messages. */
export type ApiError = {
  error: string;
  code: string;
  fields?: Record<string, string>;
};

/** 409 when an admin edits something another admin has changed since (SYS-NFR-04, 05). */
export type VersionConflict<T> = ApiError & { code: 'version_conflict'; current: T };

export type VehicleTypeRecord = {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  sortOrder: number;
  version: number;
};

export type LocationRecord = {
  id: string;
  type: LocationType;
  name: string;
  detail: string | null;
  isActive: boolean;
  sortOrder: number;
  version: number;
};

export type CampusFareRecord = {
  fromId: string;
  toId: string;
  vehicleTypeId: string;
  fare: number;
  version: number;
  updatedAt: string;
};

export type ExternalFareRangeRecord = {
  hubId: string;
  vehicleTypeId: string;
  minFare: number;
  maxFare: number;
  version: number;
  updatedAt: string;
};

/** POST /api/rides/[id]/complaints answers 201 with the rider's reference (FR-RD-13.2). */
export type ComplaintCreated = { reference: string };

/** Refusal codes of POST /api/rides/[id]/complaints. */
export type ComplaintRefusalCode =
  'invalid' | 'not_found' | 'not_on_ride' | 'window_closed' | 'already_filed' | 'daily_limit';

/** PATCH /api/admin/complaints/[id]: move a complaint along, or resolve it. */
export type ComplaintStatusChange = {
  status: Exclude<ComplaintStatus, 'submitted'>;
  /** Required when resolving: whether any action was taken (FR-RD-13.5). */
  actionTaken?: boolean;
  note?: string;
  version: number;
};

/** A complaint as an admin sees it in the queue. */
export type AdminComplaintSummary = {
  id: string;
  reference: string;
  legacyReference: string | null;
  category: ComplaintCategory;
  source: ComplaintSource;
  status: ComplaintStatus;
  createdAt: string;
};
