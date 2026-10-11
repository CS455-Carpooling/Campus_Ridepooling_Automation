import { describe, expect, it } from 'vitest';
import { parseAiDecisionRequest, validateComplaintAiAnalysis } from './complaint-ai-rules';

const analysis = {
  summary: 'The report describes unsafe driving.',
  severity: 'high',
  behaviorTags: ['safety_risk'],
  recommendedAction: 'warning',
  recommendedSuspensionDays: null,
  recommendedIndefinite: false,
  confidence: 0.8,
};

describe('validateComplaintAiAnalysis', () => {
  it('accepts only complete, known and sufficiently confident recommendations', () => {
    expect(validateComplaintAiAnalysis(analysis)).toMatchObject({
      outcome: 'ai_validated',
      recommendedAction: 'warning',
    });
    expect(validateComplaintAiAnalysis({ ...analysis, confidence: 0.64 }).outcome).toBe(
      'fallback_low_confidence',
    );
    expect(validateComplaintAiAnalysis({ ...analysis, behaviorTags: ['invented'] }).outcome).toBe(
      'fallback_invalid',
    );
    expect(
      validateComplaintAiAnalysis({
        ...analysis,
        recommendedAction: 'suspension',
        recommendedSuspensionDays: null,
      }).outcome,
    ).toBe('fallback_invalid');
  });
});

describe('parseAiDecisionRequest', () => {
  it('requires reasons for rejection and override, and never permits action after rejection', () => {
    expect(parseAiDecisionRequest({ decision: 'rejected', finalAction: 'none' }).ok).toBe(false);
    expect(
      parseAiDecisionRequest({
        decision: 'rejected',
        finalAction: 'warning',
        reason: 'Not supported by evidence.',
      }).ok,
    ).toBe(false);
    expect(
      parseAiDecisionRequest({
        decision: 'overridden',
        finalAction: 'none',
        reason: 'Manual review found insufficient evidence.',
      }),
    ).toMatchObject({ ok: true });
  });

  it('requires an explicit reason and length for enforcement actions', () => {
    expect(parseAiDecisionRequest({ decision: 'approved', finalAction: 'warning' })).toMatchObject({
      ok: false,
      errors: { reason: expect.any(String) },
    });
    expect(
      parseAiDecisionRequest({
        decision: 'approved',
        finalAction: 'suspension',
        reason: 'Repeated serious safety incidents.',
        days: 90,
      }),
    ).toMatchObject({ ok: true, value: { days: 90, indefinite: false } });
    expect(
      parseAiDecisionRequest({
        decision: 'approved',
        finalAction: 'suspension',
        reason: 'Serious safety risk.',
        indefinite: true,
      }),
    ).toMatchObject({ ok: true, value: { days: null, indefinite: true } });
  });
});
