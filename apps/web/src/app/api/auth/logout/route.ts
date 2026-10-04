import { appUrl, destroySession, json, sameOrigin } from '@/lib/auth';

export async function POST() {
  if (!(await sameOrigin())) return json({ error: 'Invalid request origin.' }, 403);
  await destroySession();
  return Response.redirect(`${appUrl()}/login`, 303);
}
