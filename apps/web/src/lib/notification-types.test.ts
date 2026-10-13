import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { notificationTypes } from './notification-types';

describe('notification type contract', () => {
  it('keeps the shared TypeScript list aligned with the deployed schema constraint', async () => {
    const schema = await readFile(resolve(process.cwd(), 'db/schema.sql'), 'utf8');
    const constraint = schema.match(
      /ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK \(type IN \(([\s\S]*?)\)\);/,
    );
    expect(constraint).not.toBeNull();
    const schemaTypeLiterals = (constraint?.[1] ?? '').match(/'([^']+)'/g) ?? [];
    const schemaTypes = schemaTypeLiterals.map((value) => value.slice(1, -1));
    expect(schemaTypes.sort()).toEqual([...notificationTypes].sort());
  });
});
