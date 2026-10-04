import { getCurrentUser, guard, json } from '@/lib/auth';
import { getRideFormOptions } from '@/lib/ride-options';

export async function GET() {
  const blocked = await guard('ride-options', 60, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  try {
    return json(await getRideFormOptions());
  } catch (error) {
    console.error('Ride form option lookup failed:', error);
    return json({ error: 'Unable to load ride options right now.' }, 500);
  }
}
