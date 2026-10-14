// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ pool: { query } }));

import { GET } from './route';

beforeEach(() => {
  query.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('/api/health', () => {
  it('returns ready when PostgreSQL responds', async () => {
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns an explicit unavailable status when PostgreSQL is down', async () => {
    query.mockRejectedValueOnce(new Error('connection string must not be exposed'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual({ status: 'unavailable' });
    expect(error).toHaveBeenCalledWith('[health] PostgreSQL readiness check failed.', 'Error');
    expect(JSON.stringify(body)).not.toContain('connection string');
  });
});
