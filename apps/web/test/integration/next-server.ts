import { currentScope } from './request-context';

/**
 * Stands in for next/server in the integration tests (see vitest.integration.config.mts). The app
 * imports only after() from it: Next.js runs that work once the response is sent, which needs
 * its own request handling, so here callRoute() runs it right after the handler answers.
 */
export function after(task: Promise<unknown> | (() => unknown)): void {
  currentScope().afterTasks.push(typeof task === 'function' ? task : () => task);
}
