import { describe, expect, it } from 'vitest';
import { isUuid } from './ids';

describe('isUuid', () => {
  it('accepts UUIDs in lower and upper case', () => {
    expect(isUuid('6f1c2a5e-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('6F1C2A5E-ABCD-4000-8000-00000000000F')).toBe(true);
  });

  it.each([
    'dev-student',
    '',
    'abc',
    '{6f1c2a5e-0000-4000-8000-000000000001}',
    '6f1c2a5e-0000-4000-8000-000000000001x',
    ' 6f1c2a5e-0000-4000-8000-000000000001',
    '6f1c2a5e00004000800000000000000001',
  ])('rejects %o', (value) => {
    expect(isUuid(value)).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
