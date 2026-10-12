declare global {
  var __joinRequestMaintenanceTimer: NodeJS.Timeout | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || globalThis.__joinRequestMaintenanceTimer) return;

  const { expireDueJoinRequests } = await import('./lib/join-requests');
  const run = () => {
    void expireDueJoinRequests().catch((error: unknown) => {
      console.error('Join-request lock maintenance failed:', error);
    });
  };
  run();
  globalThis.__joinRequestMaintenanceTimer = setInterval(run, 60_000);
  globalThis.__joinRequestMaintenanceTimer.unref();
}
