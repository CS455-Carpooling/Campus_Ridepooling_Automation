import 'server-only';
import {
  COMPLAINT_CATEGORIES,
  type ComplaintCategory,
  type ComplaintSource,
  type ComplaintStatus,
} from './complaint-rules';
import { pool } from './db';
import { isUuid } from './ids';
import type { Direction } from './ride-rules';
import { rideTitle, type RideState } from './ride-status';

/** The complaint queue's filters (CS455-53), from the page's URL. */
export type QueueFilters = {
  status: 'open' | 'resolved' | 'all';
  category: ComplaintCategory | 'all';
  source: ComplaintSource | 'all';
};

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

/** Reads the filters from the URL; anything unknown falls back to the default. */
export function parseQueueFilters(
  params: Record<string, string | string[] | undefined>,
): QueueFilters {
  const status = one(params.status);
  const category = one(params.category);
  const source = one(params.source);
  return {
    status: status === 'resolved' || status === 'all' ? status : 'open',
    category: (COMPLAINT_CATEGORIES as readonly string[]).includes(category)
      ? (category as ComplaintCategory)
      : 'all',
    source: source === 'form' || source === 'chat_report' ? source : 'all',
  };
}

/** A complaint as the queue lists it. */
export type QueueComplaint = {
  id: string;
  reference: string;
  category: ComplaintCategory;
  source: ComplaintSource;
  status: ComplaintStatus;
  createdAt: string;
  about: string;
  rideTitle: string;
  aiReview: 'manual' | 'pending' | 'decided' | 'available';
};

type QueueRow = {
  id: string;
  reference: string;
  category: ComplaintCategory;
  source: ComplaintSource;
  status: ComplaintStatus;
  created_at: Date;
  about: string;
  direction: Direction;
  hub_name: string;
  ai_outcome: ComplaintAiHistoryEntry['outcome'] | null;
  ai_action: ComplaintAiHistoryEntry['recommendedAction'];
  ai_decision_id: string | null;
};

const userName = (alias: string) => `COALESCE(${alias}_profile.display_name, ${alias}.full_name)`;

// Safety first (SYS-FR-19: the admin's "SOS complaint"), then the longest waiting.
const QUEUE_SQL = `
  SELECT c.id, c.reference, c.category, c.source, c.status, c.created_at,
         ${userName('accused')} AS about, r.direction, hub.name AS hub_name,
         analysis.outcome AS ai_outcome, analysis.recommended_action AS ai_action,
         decision.id AS ai_decision_id
  FROM complaints c
  JOIN users accused ON accused.id = c.accused_id
  LEFT JOIN user_profiles accused_profile ON accused_profile.user_id = accused.id
  JOIN rides r ON r.id = c.ride_id
  JOIN locations hub ON hub.id = r.hub_id
  LEFT JOIN LATERAL (
    SELECT a.id, a.outcome, a.recommended_action
    FROM complaint_ai_analyses a
    WHERE a.complaint_id = c.id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  ) analysis ON true
  LEFT JOIN ai_enforcement_decisions decision ON decision.analysis_id = analysis.id
  WHERE ($1 = 'all' OR ($1 = 'open') = (c.status <> 'resolved'))
    AND ($2 = 'all' OR c.category = $2)
    AND ($3 = 'all' OR c.source = $3)
  ORDER BY (c.category = 'safety' AND c.status <> 'resolved') DESC,
           CASE WHEN c.status = 'resolved' THEN NULL ELSE c.created_at END ASC NULLS LAST,
           c.resolved_at DESC NULLS LAST, c.created_at DESC
  LIMIT 200`;

/** The complaint queue (OA-FR-16, 18): open ones by default, Safety first, chat reports included. */
export async function listComplaints(filters: QueueFilters): Promise<QueueComplaint[]> {
  const { rows } = await pool.query<QueueRow>(QUEUE_SQL, [
    filters.status,
    filters.category,
    filters.source,
  ]);
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    category: row.category,
    source: row.source,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    about: row.about,
    rideTitle: rideTitle(row.direction, row.hub_name),
    aiReview: Boolean(row.ai_decision_id)
      ? 'decided'
      : row.ai_outcome === null || row.ai_outcome !== 'ai_validated'
        ? 'manual'
        : row.ai_action === 'warning' || row.ai_action === 'suspension'
          ? 'pending'
          : 'available',
  }));
}

export type ComplaintPersonLink = { id: string; name: string; email: string };

export type EarlierComplaint = {
  id: string;
  reference: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  createdAt: string;
};

export type ComplaintAiHistoryEntry = {
  id: string;
  outcome:
    | 'ai_validated'
    | 'fallback_model_error'
    | 'fallback_timeout'
    | 'fallback_invalid'
    | 'fallback_low_confidence'
    | 'fallback_service_error';
  summary: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  behaviorTags: string[];
  recommendedAction: 'none' | 'warning' | 'suspension' | null;
  recommendedSuspensionDays: number | null;
  recommendedIndefinite: boolean;
  confidence: number | null;
  createdAt: string;
  decision: null | {
    id: string;
    decision: 'approved' | 'rejected' | 'overridden';
    reason: string | null;
    finalAction: 'none' | 'warning' | 'suspension';
    decidedAt: string;
    decidedBy: string;
    warningId: string | null;
    suspensionId: string | null;
  };
};

export type AiDecisionHistoryItem = {
  id: string;
  analysisId: string;
  complaintId: string;
  complaintReference: string;
  accusedId: string;
  accusedName: string;
  analysisSummary: string | null;
  recommendedAction: 'none' | 'warning' | 'suspension';
  recommendedSuspensionDays: number | null;
  recommendedIndefinite: boolean;
  decision: 'approved' | 'rejected' | 'overridden';
  reason: string | null;
  finalAction: 'none' | 'warning' | 'suspension';
  warningId: string | null;
  suspensionId: string | null;
  decidedAt: string;
  decidedBy: string;
};

/** Everything about one complaint, for the admin (OA-FR-18, 20; SYS-FR-31, 47). */
export type AdminComplaintDetail = {
  id: string;
  reference: string;
  legacyReference: string | null;
  category: ComplaintCategory;
  source: ComplaintSource;
  status: ComplaintStatus;
  actionTaken: boolean | null;
  note: string | null;
  version: number;
  /** The complainant's own words, exactly as filed. */
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  complainant: ComplaintPersonLink;
  accused: ComplaintPersonLink;
  ride: {
    id: string;
    title: string;
    departureStart: string;
    departureEnd: string;
    state: RideState;
  };
  /** The chat messages the complaint is about. */
  messages: Array<{ id: string; body: string; sentAt: string; senderName: string }>;
  /** Other complaints about the same person, newest first (OA-FR-20). */
  earlierAboutAccused: EarlierComplaint[];
  /** AI analysis attempts and human decisions; the source complaint remains authoritative. */
  aiHistory: ComplaintAiHistoryEntry[];
};

type DetailRow = {
  id: string;
  reference: string;
  legacy_reference: string | null;
  category: ComplaintCategory;
  source: ComplaintSource;
  status: ComplaintStatus;
  action_taken: boolean | null;
  resolution_note: string | null;
  version: number;
  description: string;
  created_at: Date;
  resolved_at: Date | null;
  resolved_by_name: string | null;
  complainant_id: string;
  complainant_name: string;
  complainant_email: string;
  accused_id: string;
  accused_name: string;
  accused_email: string;
  ride_id: string;
  direction: Direction;
  hub_name: string;
  departure_start: Date;
  departure_end: Date;
  ride_state: RideState;
};

const DETAIL_SQL = `
  SELECT c.id, c.reference, c.legacy_reference, c.category, c.source, c.status, c.action_taken,
         c.resolution_note, c.version, c.description, c.created_at, c.resolved_at,
         resolver.full_name AS resolved_by_name,
         complainant.id AS complainant_id, ${userName('complainant')} AS complainant_name,
         complainant.email AS complainant_email,
         accused.id AS accused_id, ${userName('accused')} AS accused_name,
         accused.email AS accused_email,
         r.id AS ride_id, r.direction, hub.name AS hub_name, r.departure_start, r.departure_end,
         r.state AS ride_state
  FROM complaints c
  JOIN users complainant ON complainant.id = c.complainant_id
  LEFT JOIN user_profiles complainant_profile ON complainant_profile.user_id = complainant.id
  JOIN users accused ON accused.id = c.accused_id
  LEFT JOIN user_profiles accused_profile ON accused_profile.user_id = accused.id
  LEFT JOIN users resolver ON resolver.id = c.resolved_by
  JOIN rides r ON r.id = c.ride_id
  JOIN locations hub ON hub.id = r.hub_id
  WHERE c.id = $1`;

const MESSAGES_SQL = `
  SELECT m.id, m.body, m.created_at, ${userName('sender')} AS sender_name
  FROM complaint_chat_messages link
  JOIN ride_chat_messages m ON m.id = link.message_id
  JOIN users sender ON sender.id = m.sender_id
  LEFT JOIN user_profiles sender_profile ON sender_profile.user_id = sender.id
  WHERE link.complaint_id = $1
  ORDER BY m.created_at`;

const EARLIER_SQL = `
  SELECT id, reference, category, status, created_at FROM complaints
  WHERE accused_id = $1 AND id <> $2
  ORDER BY created_at DESC
  LIMIT 20`;

const AI_HISTORY_SQL = `
  SELECT a.id, a.outcome, a.summary, a.severity, a.behavior_tags, a.recommended_action,
         a.recommended_suspension_days, a.recommended_indefinite, a.confidence, a.created_at,
         d.id AS decision_id, d.decision, d.reason AS decision_reason, d.final_action,
         d.decided_at, decider.full_name AS decided_by, d.warning_id, d.suspension_id
  FROM complaint_ai_analyses a
  LEFT JOIN ai_enforcement_decisions d ON d.analysis_id = a.id
  LEFT JOIN users decider ON decider.id = d.decided_by
  WHERE a.complaint_id = $1
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT 20`;

const AI_DECISION_HISTORY_SQL = `
  SELECT d.id, d.analysis_id, d.complaint_id, c.reference AS complaint_reference,
         c.accused_id, COALESCE(profile.display_name, rider.full_name) AS accused_name,
         a.summary AS analysis_summary, a.recommended_action, a.recommended_suspension_days,
         a.recommended_indefinite, d.decision, d.reason, d.final_action, d.warning_id,
         d.suspension_id, d.decided_at, admin.full_name AS decided_by
  FROM ai_enforcement_decisions d
  JOIN complaint_ai_analyses a ON a.id = d.analysis_id
  JOIN complaints c ON c.id = d.complaint_id
  JOIN users rider ON rider.id = c.accused_id
  LEFT JOIN user_profiles profile ON profile.user_id = rider.id
  JOIN users admin ON admin.id = d.decided_by
  ORDER BY d.decided_at DESC, d.id DESC
  LIMIT 200`;

/** The restricted Admin history required for AI recommendations and final human decisions. */
export async function listAiDecisionHistory(): Promise<AiDecisionHistoryItem[]> {
  const { rows } = await pool.query<{
    id: string;
    analysis_id: string;
    complaint_id: string;
    complaint_reference: string;
    accused_id: string;
    accused_name: string;
    analysis_summary: string | null;
    recommended_action: 'none' | 'warning' | 'suspension';
    recommended_suspension_days: number | null;
    recommended_indefinite: boolean;
    decision: AiDecisionHistoryItem['decision'];
    reason: string | null;
    final_action: AiDecisionHistoryItem['finalAction'];
    warning_id: string | null;
    suspension_id: string | null;
    decided_at: Date;
    decided_by: string;
  }>(AI_DECISION_HISTORY_SQL);
  return rows.map((row) => ({
    id: row.id,
    analysisId: row.analysis_id,
    complaintId: row.complaint_id,
    complaintReference: row.complaint_reference,
    accusedId: row.accused_id,
    accusedName: row.accused_name,
    analysisSummary: row.analysis_summary,
    recommendedAction: row.recommended_action,
    recommendedSuspensionDays: row.recommended_suspension_days,
    recommendedIndefinite: row.recommended_indefinite,
    decision: row.decision,
    reason: row.reason,
    finalAction: row.final_action,
    warningId: row.warning_id,
    suspensionId: row.suspension_id,
    decidedAt: row.decided_at.toISOString(),
    decidedBy: row.decided_by,
  }));
}

/** One complaint for the admin, or null when there is none with that ID. */
export async function getComplaintDetail(id: string): Promise<AdminComplaintDetail | null> {
  if (!isUuid(id)) return null;
  const row = (await pool.query<DetailRow>(DETAIL_SQL, [id])).rows[0];
  if (!row) return null;
  const [messages, earlier, aiHistory] = await Promise.all([
    pool.query<{ id: string; body: string; created_at: Date; sender_name: string }>(MESSAGES_SQL, [
      id,
    ]),
    pool.query<{
      id: string;
      reference: string;
      category: ComplaintCategory;
      status: ComplaintStatus;
      created_at: Date;
    }>(EARLIER_SQL, [row.accused_id, id]),
    pool.query<{
      id: string;
      outcome: ComplaintAiHistoryEntry['outcome'];
      summary: string | null;
      severity: ComplaintAiHistoryEntry['severity'];
      behavior_tags: string[];
      recommended_action: ComplaintAiHistoryEntry['recommendedAction'];
      recommended_suspension_days: number | null;
      recommended_indefinite: boolean;
      confidence: number | null;
      created_at: Date;
      decision_id: string | null;
      decision: 'approved' | 'rejected' | 'overridden' | null;
      decision_reason: string | null;
      final_action: 'none' | 'warning' | 'suspension' | null;
      decided_at: Date | null;
      decided_by: string | null;
      warning_id: string | null;
      suspension_id: string | null;
    }>(AI_HISTORY_SQL, [id]),
  ]);
  return {
    id: row.id,
    reference: row.reference,
    legacyReference: row.legacy_reference,
    category: row.category,
    source: row.source,
    status: row.status,
    actionTaken: row.action_taken,
    note: row.resolution_note,
    version: row.version,
    description: row.description,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    resolvedBy: row.resolved_by_name,
    complainant: {
      id: row.complainant_id,
      name: row.complainant_name,
      email: row.complainant_email,
    },
    accused: { id: row.accused_id, name: row.accused_name, email: row.accused_email },
    ride: {
      id: row.ride_id,
      title: rideTitle(row.direction, row.hub_name),
      departureStart: row.departure_start.toISOString(),
      departureEnd: row.departure_end.toISOString(),
      state: row.ride_state,
    },
    messages: messages.rows.map((message) => ({
      id: message.id,
      body: message.body,
      sentAt: message.created_at.toISOString(),
      senderName: message.sender_name,
    })),
    earlierAboutAccused: earlier.rows.map((complaint) => ({
      id: complaint.id,
      reference: complaint.reference,
      category: complaint.category,
      status: complaint.status,
      createdAt: complaint.created_at.toISOString(),
    })),
    aiHistory: aiHistory.rows.map((analysis) => ({
      id: analysis.id,
      outcome: analysis.outcome,
      summary: analysis.summary,
      severity: analysis.severity,
      behaviorTags: analysis.behavior_tags,
      recommendedAction: analysis.recommended_action,
      recommendedSuspensionDays: analysis.recommended_suspension_days,
      recommendedIndefinite: analysis.recommended_indefinite,
      confidence: analysis.confidence,
      createdAt: analysis.created_at.toISOString(),
      decision:
        analysis.decision_id && analysis.decision && analysis.final_action && analysis.decided_at
          ? {
              id: analysis.decision_id,
              decision: analysis.decision,
              reason: analysis.decision_reason,
              finalAction: analysis.final_action,
              decidedAt: analysis.decided_at.toISOString(),
              decidedBy: analysis.decided_by ?? 'An admin',
              warningId: analysis.warning_id,
              suspensionId: analysis.suspension_id,
            }
          : null,
    })),
  };
}
