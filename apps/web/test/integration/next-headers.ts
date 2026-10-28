import { currentScope } from './request-context';

/**
 * Stands in for next/headers in the integration tests (see vitest.integration.config.mts).
 * Next.js only answers cookies() and headers() inside its own request handling; here they read
 * the request that callRoute() is running.
 */
export async function headers(): Promise<Headers> {
  return currentScope().headers;
}

export async function cookies() {
  const jar = currentScope().cookies;
  return {
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    has: (name: string) => jar.has(name),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  };
}
