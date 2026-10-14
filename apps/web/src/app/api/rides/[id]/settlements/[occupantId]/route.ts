import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import {
  changeSettlement,
  type SettlementAction,
  type SettlementResult,
} from '@/lib/payment-settlement';
import { parsePaymentInput } from '@/lib/payment-rules';
import { pool } from '@/lib/db';

function refusal(result: Exclude<SettlementResult, { kind: 'done' }>): Response {
  if (result.kind === 'not_found')
    return json({ error: 'Ride or seat not found.', code: 'not_found' }, 404);
  if (result.kind === 'not_owner' || result.kind === 'not_rider') {
    return json({ error: 'You cannot update this payment.', code: result.kind }, 403);
  }
  const errors = {
    not_completed: 'Payment settlement is available after the ride is completed.',
    no_payable_share: 'This seat has no payable share.',
    already_handled: 'This payment is no longer awaiting this action.',
  };
  return json({ error: errors[result.kind], code: result.kind }, 409);
}

export async function POST(
  req: Request,
  ctx: RouteContext<'/api/rides/[id]/settlements/[occupantId]'>,
) {
  const blocked = await guard('settlement', 30, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id, occupantId } = await ctx.params;
  if (!isUuid(id) || !isUuid(occupantId)) {
    return json({ error: 'Ride or seat not found.', code: 'not_found' }, 404);
  }

  const body = await readJson(req);
  let action: SettlementAction;
  if (body.action === 'paid') {
    const payment = parsePaymentInput(body);
    if (!payment.ok) {
      return json(
        {
          error: 'Choose UPI or cash and use a reference of at most 50 characters.',
          code: 'invalid',
        },
        400,
      );
    }
    action = { type: 'paid', input: payment.value };
  } else if (body.action === 'confirm' || body.action === 'dispute') {
    action = { type: body.action };
  } else {
    return json({ error: 'Choose a valid payment action.', code: 'invalid' }, 400);
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await changeSettlement(client, id, occupantId, user.id, action, new Date());
    await client.query(result.kind === 'done' ? 'COMMIT' : 'ROLLBACK');
    if (result.kind !== 'done') return refusal(result);
    return json({
      status: result.status,
      ...(result.complaintReference ? { complaintReference: result.complaintReference } : {}),
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Update payment settlement failed:', error);
    return json({ error: 'Unable to update settlement right now.', code: 'server_error' }, 500);
  } finally {
    client?.release();
  }
}
