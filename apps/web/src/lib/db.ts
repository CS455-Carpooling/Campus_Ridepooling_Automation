import { Pool } from 'pg';

const g = globalThis as unknown as { __pgPool?: Pool };
const rawUrl = process.env.DATABASE_URL;
const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
const url = /^postgres(?:ql)?:\/\//i.test(normalized) ? normalized : undefined;

export const pool =
  g.__pgPool ??
  new Pool({
    connectionString: url,
    // Render's external URL needs TLS; the internal URL does not.
    ssl: url?.includes('.render.com') ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
g.__pgPool = pool;
