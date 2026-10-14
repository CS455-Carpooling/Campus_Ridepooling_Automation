import { getCurrentUser, guard, json, readJson } from '../../../../lib/auth';
import { isUuid } from '../../../../lib/ids';
import { confirmPreferenceProposal } from '../../../../lib/ai/preference-proposals';

export async function POST(req: Request) {
  const blocked = await guard('chatbot-confirm-preference', 20, 300);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) {
    return json({ error: 'Authentication required.' }, 401);
  }

  const body = await readJson(req);
  const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';

  if (!proposalId || !isUuid(proposalId)) {
    return json({ error: 'A valid proposal ID is required.' }, 400);
  }

  const result = await confirmPreferenceProposal(proposalId, user.id);

  if (!result.success) {
    return json(
      {
        error: result.error ?? 'Failed to apply preference proposal.',
      },
      400,
    );
  }

  return json({
    success: true,
    message: 'Preferences updated successfully.',
  });
}
