import { COMPLAINT_CATEGORIES, type ComplaintCategory } from './complaint-rules';

export const COMPLAINT_AI_CONFIDENCE_THRESHOLD = 0.65;
export const COMPLAINT_AI_TAGS = [
  'payment_issue',
  'safety_risk',
  'harassment',
  'tardiness',
  'no_show',
  'repeated_behavior',
  'communication_issue',
  'policy_concern',
  'other',
] as const;

export type ComplaintAiSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintAiAction = 'none' | 'warning' | 'suspension';
export type ComplaintAiFallback =
  | 'fallback_model_error'
  | 'fallback_timeout'
  | 'fallback_invalid'
  | 'fallback_low_confidence'
  | 'fallback_service_error';

export type ValidatedComplaintAiAnalysis = {
  outcome: 'ai_validated';
  summary: string;
  severity: ComplaintAiSeverity;
  behaviorTags: string[];
  recommendedAction: ComplaintAiAction;
  recommendedSuspensionDays: number | null;
  recommendedIndefinite: boolean;
  confidence: number;
};

export type ComplaintAiAnalysis =
  | ValidatedComplaintAiAnalysis
  | {
      outcome: ComplaintAiFallback;
      summary: null;
      severity: null;
      behaviorTags: [];
      recommendedAction: null;
      recommendedSuspensionDays: null;
      recommendedIndefinite: false;
      confidence: null;
    };

export type AiDecisionName = 'approved' | 'rejected' | 'overridden';
export type AiDecisionAction = ComplaintAiAction;

export type AiDecisionRequest = {
  decision: AiDecisionName;
  finalAction: AiDecisionAction;
  reason: string | null;
  days: number | null;
  indefinite: boolean;
};

const FALLBACKS: Record<ComplaintAiFallback, ComplaintAiAnalysis> = {
  fallback_model_error: {
    outcome: 'fallback_model_error',
    summary: null,
    severity: null,
    behaviorTags: [],
    recommendedAction: null,
    recommendedSuspensionDays: null,
    recommendedIndefinite: false,
    confidence: null,
  },
  fallback_timeout: {
    outcome: 'fallback_timeout',
    summary: null,
    severity: null,
    behaviorTags: [],
    recommendedAction: null,
    recommendedSuspensionDays: null,
    recommendedIndefinite: false,
    confidence: null,
  },
  fallback_invalid: {
    outcome: 'fallback_invalid',
    summary: null,
    severity: null,
    behaviorTags: [],
    recommendedAction: null,
    recommendedSuspensionDays: null,
    recommendedIndefinite: false,
    confidence: null,
  },
  fallback_low_confidence: {
    outcome: 'fallback_low_confidence',
    summary: null,
    severity: null,
    behaviorTags: [],
    recommendedAction: null,
    recommendedSuspensionDays: null,
    recommendedIndefinite: false,
    confidence: null,
  },
  fallback_service_error: {
    outcome: 'fallback_service_error',
    summary: null,
    severity: null,
    behaviorTags: [],
    recommendedAction: null,
    recommendedSuspensionDays: null,
    recommendedIndefinite: false,
    confidence: null,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validAnalysis(value: unknown): Omit<ValidatedComplaintAiAnalysis, 'outcome'> | null {
  if (!isRecord(value)) return null;
  const {
    summary,
    severity,
    behaviorTags,
    recommendedAction,
    recommendedSuspensionDays,
    recommendedIndefinite,
    confidence,
  } = value;
  if (
    typeof summary !== 'string' ||
    summary.trim().length < 1 ||
    Array.from(summary.trim()).length > 2000 ||
    !['low', 'medium', 'high', 'critical'].includes(String(severity)) ||
    !['none', 'warning', 'suspension'].includes(String(recommendedAction)) ||
    typeof recommendedIndefinite !== 'boolean' ||
    !Array.isArray(behaviorTags) ||
    behaviorTags.length > 8 ||
    behaviorTags.some(
      (tag) => typeof tag !== 'string' || !(COMPLAINT_AI_TAGS as readonly string[]).includes(tag),
    ) ||
    new Set(behaviorTags).size !== behaviorTags.length ||
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return null;
  }

  const action = recommendedAction as ComplaintAiAction;
  const indefinite = recommendedIndefinite;
  const days = recommendedSuspensionDays;
  if (action === 'suspension') {
    if (
      indefinite
        ? days !== null
        : !Number.isInteger(days) || Number(days) < 1 || Number(days) > 3650
    ) {
      return null;
    }
  } else if (indefinite || days !== null) {
    return null;
  }

  return {
    summary: summary.trim(),
    severity: severity as ComplaintAiSeverity,
    behaviorTags: [...behaviorTags] as string[],
    recommendedAction: action,
    recommendedSuspensionDays: action === 'suspension' ? (days as number | null) : null,
    recommendedIndefinite: action === 'suspension' && indefinite,
    confidence,
  };
}

export function validateComplaintAiAnalysis(
  value: unknown,
  threshold = COMPLAINT_AI_CONFIDENCE_THRESHOLD,
): ComplaintAiAnalysis {
  const analysis = validAnalysis(value);
  if (!analysis) return FALLBACKS.fallback_invalid;
  if (analysis.confidence < threshold) return FALLBACKS.fallback_low_confidence;
  return { outcome: 'ai_validated', ...analysis };
}

export const complaintAiFallback = (outcome: ComplaintAiFallback): ComplaintAiAnalysis =>
  FALLBACKS[outcome];

export type AiDecisionErrors = Partial<
  Record<'decision' | 'finalAction' | 'reason' | 'length', string>
>;

export type AiDecisionParseResult =
  { ok: true; value: AiDecisionRequest } | { ok: false; errors: AiDecisionErrors };

const validReason = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 1 && Array.from(reason).length <= 1000 ? reason : null;
};

export function parseAiDecisionRequest(body: unknown): AiDecisionParseResult {
  const input = isRecord(body) ? body : {};
  const errors: AiDecisionErrors = {};
  const decision = input.decision;
  const finalAction = input.finalAction;
  const reason =
    input.reason === undefined || input.reason === null ? null : validReason(input.reason);
  if (!['approved', 'rejected', 'overridden'].includes(String(decision))) {
    errors.decision = 'Choose approve, reject, or override.';
  }
  if (!['none', 'warning', 'suspension'].includes(String(finalAction))) {
    errors.finalAction = 'Choose no action, warning, or suspension.';
  }
  if (input.reason !== undefined && input.reason !== null && reason === null) {
    errors.reason = 'Give a reason of up to 1000 characters.';
  }
  if ((decision === 'rejected' || decision === 'overridden') && !reason) {
    errors.reason = 'A reason is required to reject or override a recommendation.';
  }
  if (decision === 'rejected' && finalAction !== 'none') {
    errors.finalAction = 'A rejected recommendation cannot take enforcement action.';
  }
  if (finalAction === 'warning' && !reason) {
    errors.reason = 'Give a reason for issuing a warning.';
  }

  const indefinite = input.indefinite === true;
  const days = input.days;
  if (input.indefinite !== undefined && typeof input.indefinite !== 'boolean') {
    errors.length = 'Choose a valid suspension length.';
  }
  if (finalAction === 'suspension') {
    const validDays =
      typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 3650;
    const noDays = days === undefined || days === null;
    if (indefinite ? !noDays : !validDays) {
      errors.length = 'Choose a suspension from 1 to 3650 days, or explicitly select indefinite.';
    }
    if (!reason) errors.reason = 'Give a reason for issuing a suspension.';
  } else if (indefinite || (days !== undefined && days !== null)) {
    errors.length = 'A suspension length is only valid for a suspension action.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      decision: decision as AiDecisionName,
      finalAction: finalAction as AiDecisionAction,
      reason,
      days: indefinite ? null : ((days as number | null | undefined) ?? null),
      indefinite,
    },
  };
}

export function complaintCategoryForAiSuspension(category: string): ComplaintCategory | null {
  return (COMPLAINT_CATEGORIES as readonly string[]).includes(category)
    ? (category as ComplaintCategory)
    : null;
}
