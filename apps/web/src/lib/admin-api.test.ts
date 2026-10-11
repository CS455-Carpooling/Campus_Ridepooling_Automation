// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  fromConfigWrite,
  fromEnforcementWrite,
  invalidRequest,
  isConfigId,
  notFound,
} from './admin-api';

describe('admin API answers', () => {
  it('sends field messages as a 400 and unknown items as a 404', async () => {
    const invalid = invalidRequest({ name: 'Enter a name.' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: 'Check the highlighted fields.',
      code: 'invalid',
      fields: { name: 'Enter a name.' },
    });
    const missing = notFound('Rider');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Rider not found.', code: 'not_found' });
  });

  it('accepts only short slug IDs for vehicle types and places', () => {
    expect(isConfigId('kanpur-central')).toBe(true);
    expect(isConfigId('hall-6')).toBe(true);
    expect(isConfigId('Hall 6')).toBe(false);
    expect(isConfigId('-x')).toBe(false);
    expect(isConfigId('a'.repeat(41))).toBe(false);
  });
});

describe('fromConfigWrite', () => {
  const record = { id: 'auto', version: 2 };

  it('passes a saved item on with its ID and before/after for the audit', () => {
    expect(
      fromConfigWrite({ kind: 'saved', record, before: { id: 'auto', version: 1 } }, (r) => r.id),
    ).toEqual({
      ok: true,
      value: record,
      entityId: 'auto',
      before: { id: 'auto', version: 1 },
      after: record,
    });
  });

  it('turns each refusal into its status and code', () => {
    expect(fromConfigWrite({ kind: 'not_found' }, () => '')).toMatchObject({
      status: 404,
      code: 'not_found',
    });
    expect(fromConfigWrite({ kind: 'version_conflict', current: record }, () => '')).toMatchObject({
      status: 409,
      code: 'version_conflict',
      current: record,
    });
    expect(
      fromConfigWrite({ kind: 'invalid', fields: { name: 'Taken.' } }, () => ''),
    ).toMatchObject({
      status: 400,
      code: 'invalid',
      fields: { name: 'Taken.' },
    });
  });
});

describe('fromEnforcementWrite', () => {
  it('passes a done action on, and turns each refusal into its status and code', () => {
    expect(fromEnforcementWrite({ kind: 'done', record: { id: 'w-1' } })).toEqual({
      ok: true,
      value: { id: 'w-1' },
      after: { id: 'w-1' },
    });
    expect(fromEnforcementWrite({ kind: 'not_found' })).toMatchObject({ status: 404 });
    expect(fromEnforcementWrite({ kind: 'not_a_rider' })).toMatchObject({
      status: 400,
      code: 'not_a_rider',
    });
    expect(fromEnforcementWrite({ kind: 'complaint_mismatch' })).toMatchObject({
      status: 400,
      fields: { complaintId: 'That complaint is not about this rider.' },
    });
    expect(fromEnforcementWrite({ kind: 'already_suspended', endsAt: null })).toMatchObject({
      status: 409,
      code: 'already_suspended',
    });
    expect(fromEnforcementWrite({ kind: 'not_suspended' })).toMatchObject({
      status: 409,
      code: 'not_suspended',
    });
  });
});
