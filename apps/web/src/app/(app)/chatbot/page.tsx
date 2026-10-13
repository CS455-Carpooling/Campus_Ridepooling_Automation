import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getRideFormOptions } from '@/lib/ride-options';
import { routes } from '@/lib/routes';
import { ChatbotInterface } from '@/components/chatbot/ChatbotInterface';

export const metadata: Metadata = {
  title: 'AI Assistant — Campus Ride-Pooling',
  description:
    'Natural-language ride search, public profile queries, and preference management assistant.',
};

/**
 * The /chatbot page: Tab-local natural-language AI assistant for campus ride-pooling (Deliverable 1, FR-RD-05).
 * Conversational state is isolated to the browser tab's sessionStorage and discarded on sign-out/reload (FR-RD-05.6).
 */
export default async function ChatbotPage() {
  const user = await getCurrentUser();
  if (!user) redirect(routes.login);

  const options = await getRideFormOptions();

  return <ChatbotInterface userId={user.id} options={options} />;
}
