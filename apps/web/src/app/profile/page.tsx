import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { getProfileData } from '@/lib/profile-data';
import { verifySession } from '@/lib/session';

export const metadata: Metadata = { title: 'Your profile' };

export default async function ProfilePage() {
  const session = await verifySession();
  const profile = await getProfileData(session.userId);
  if (!profile) notFound();

  return <ProfileEditor profile={profile} />;
}
