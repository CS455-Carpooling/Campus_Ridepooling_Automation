// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pg = vi.hoisted(() => ({ constructed: [] as Array<Record<string, unknown>> }));

vi.mock('pg', () => ({
  Pool: class FakePool {
    constructor(opts: Record<string, unknown>) {
      pg.constructed.push(opts);
    }
  },
}));

const g = globalThis as unknown as { __pgPool?: unknown };

async function load() {
  vi.resetModules();
  return import('./db');
}

describe('db pool', () => {
  beforeEach(() => {
    pg.constructed.length = 0;
    delete g.__pgPool;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a pool without TLS for a local URL', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5433/crp');
    await load();
    expect(pg.constructed).toEqual([
      { connectionString: 'postgres://u:p@localhost:5433/crp', ssl: undefined, max: 10 },
    ]);
  });

  it('enables TLS for a Render URL', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@db.oregon-postgres.render.com/crp');
    await load();
    expect(pg.constructed[0].ssl).toEqual({ rejectUnauthorized: false });
  });

  it('copes with a missing DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', undefined);
    await load();
    expect(pg.constructed[0].ssl).toBeUndefined();
  });

  it('ignores malformed DATABASE_URL values', async () => {
    const original = process.env.DATABASE_URL;
    Object.defineProperty(process.env, 'DATABASE_URL', {
      value: '[object Object]',
      configurable: true,
      enumerable: true,
      writable: true,
    });
    try {
      await load();
      expect(pg.constructed[0].connectionString).toBeUndefined();
      expect(pg.constructed[0].ssl).toBeUndefined();
    } finally {
      Object.defineProperty(process.env, 'DATABASE_URL', {
        value: original,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
  });

  it('reuses the pool across module reloads', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/crp');
    const first = await load();
    const second = await load();
    expect(second.pool).toBe(first.pool);
    expect(pg.constructed).toHaveLength(1);
  });
});
