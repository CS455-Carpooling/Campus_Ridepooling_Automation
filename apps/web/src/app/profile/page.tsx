import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { getProfileData, hasCompletedProfileSetup } from '@/lib/profile-data';
import { verifySession } from '@/lib/session';

export const metadata: Metadata = { title: 'Your profile' };

export default async function ProfilePage() {
  const session = await verifySession({ allowIncompleteProfile: true });
  const [profile, setupComplete] = await Promise.all([
    getProfileData(session.userId),
    hasCompletedProfileSetup(session.userId),
  ]);
  if (!profile) notFound();

  return (
    <ProfileEditor profile={profile} setupRequired={session.role === 'student' && !setupComplete} />
  );
}
