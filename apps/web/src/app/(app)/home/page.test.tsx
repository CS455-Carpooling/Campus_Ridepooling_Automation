import { describe, expect, it, vi } from 'vitest';
import HomePage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

describe('HomePage', () => {
  it('redirects the legacy /home route to the dashboard', () => {
    expect(() => HomePage()).toThrow('NEXT_REDIRECT /dashboard');
  });
});
