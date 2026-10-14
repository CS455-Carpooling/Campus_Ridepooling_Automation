import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { WarningAcknowledgement } from '@/components/warnings/WarningAcknowledgement';
import { hasCompletedProfileSetup } from '@/lib/profile-data';
import { routes } from '@/lib/routes';
import { verifySession } from '@/lib/session';
import { listPendingRiderWarnings } from '@/lib/warnings';

export const metadata: Metadata = { title: 'Account warnings' };

export default async function WarningsPage() {
  const session = await verifySession({
    allowIncompleteProfile: true,
    allowWarningAcknowledgement: true,
  });
  if (session.role !== 'student' || session.userId.startsWith('dev-')) redirect(routes.home);

  const warnings = await listPendingRiderWarnings(session.userId);
  if (warnings.length === 0) {
    if (!(await hasCompletedProfileSetup(session.userId))) redirect(routes.profile);
    redirect(routes.home);
  }
  return <WarningAcknowledgement warnings={warnings} />;
}
