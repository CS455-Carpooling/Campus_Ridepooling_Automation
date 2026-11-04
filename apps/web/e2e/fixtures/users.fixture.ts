import { createAccount, createSessionToken } from '../../test/seed/accounts';
import type { E2ETestDatabase } from './database.fixture';

export interface SeededUser {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
  sessionToken: string;
}

export async function seedRider(
  db: E2ETestDatabase,
  options: { name?: string; campusPlace?: string; mobile?: string } = {},
): Promise<SeededUser> {
  const account = await createAccount(db, {
    role: 'student',
    name: options.name ?? 'Aarav Rider',
    campusPlace: options.campusPlace ?? 'hall-1',
    mobile: options.mobile ?? '9876543210',
  });
  const sessionToken = await createSessionToken(db, account.id);
  return { ...account, sessionToken };
}

export async function seedOwner(
  db: E2ETestDatabase,
  options: { name?: string; campusPlace?: string; mobile?: string } = {},
): Promise<SeededUser> {
  const account = await createAccount(db, {
    role: 'student',
    name: options.name ?? 'Rohan Owner',
    campusPlace: options.campusPlace ?? 'hall-3',
    mobile: options.mobile ?? '9876543211',
  });
  const sessionToken = await createSessionToken(db, account.id);
  return { ...account, sessionToken };
}

export async function seedAdmin(
  db: E2ETestDatabase,
  options: { name?: string } = {},
): Promise<SeededUser> {
  const account = await createAccount(db, {
    role: 'admin',
    name: options.name ?? 'System Administrator',
  });
  const sessionToken = await createSessionToken(db, account.id);
  return { ...account, sessionToken };
}
