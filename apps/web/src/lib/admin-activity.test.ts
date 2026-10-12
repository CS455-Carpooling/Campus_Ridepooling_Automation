import { describe, expect, it } from 'vitest';
import {
  adminActionLabel,
  adminActionLabels,
  adminActorLabel,
  adminOutcomeLabels,
} from './admin-activity';

describe('adminActionLabel', () => {
  it('names each action the admin pages and APIs audit', () => {
    expect(adminActionLabel('rider.suspend')).toBe('Suspended a rider');
    expect(adminActionLabel('role.grant')).toBe('Made an operations admin');
    for (const label of Object.values(adminActionLabels)) expect(label).toMatch(/^[A-Z][a-z]/);
  });

  it('shows the code of an action it has no label for, rather than nothing', () => {
    expect(adminActionLabel('fare.import')).toBe('fare.import');
    expect(adminActionLabel('toString')).toBe('toString');
  });
});

describe('adminOutcomeLabels (SYS-NFR-12)', () => {
  it('keeps done, refused and failed apart', () => {
    expect(new Set(Object.values(adminOutcomeLabels)).size).toBe(3);
  });
});

describe('adminActorLabel', () => {
  it('names the admin, the operator script or the system', () => {
    expect(adminActorLabel('admin', 'Ops Admin')).toBe('Ops Admin');
    expect(adminActorLabel('admin', null)).toBe('An admin');
    expect(adminActorLabel('operator_script', null)).toBe('Operator script');
    expect(adminActorLabel('system', null)).toBe('System');
  });
});
