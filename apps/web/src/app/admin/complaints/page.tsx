import { redirect } from 'next/navigation';
import { ChatComplaintQueue } from '@/components/admin/ChatComplaintQueue';
import { listOpenChatComplaints } from '@/lib/ride-chat';
import { getSession } from '@/lib/session';
import { routes } from '@/lib/routes';

export default async function AdminComplaintsPage() {
  const session = await getSession();
  if (!session) redirect(routes.login);
  if (session.role !== 'admin') redirect(routes.home);
  const reports = await listOpenChatComplaints();
  return <ChatComplaintQueue initialReports={reports} />;
}
