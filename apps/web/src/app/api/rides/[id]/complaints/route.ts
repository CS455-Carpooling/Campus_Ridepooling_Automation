import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { complaintMessages, parseComplaintRequest } from '@/lib/complaint-rules';
import { analyzeComplaint } from '@/lib/complaint-ai';
import { fileComplaint, type FileComplaintResult } from '@/lib/complaints';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';

const windowRefusals = {
  not_completed:
    'A complaint can be filed once the ride is marked completed. To report a chat message now, use Report on the message.',
  cancelled: 'This ride was cancelled, so a complaint about the trip cannot be filed.',
  closed: 'Complaints about a trip can be filed until 7 days after it was completed.',
} as const;

function refuse(result: Exclude<FileComplaintResult, { kind: 'filed' }>): Response {
  switch (result.kind) {
    case 'not_found':
      return json({ error: 'Ride not found.', code: 'not_found' }, 404);
    case 'not_on_ride':
      return json(
        {
          error: 'Check the highlighted fields.',
          code: 'not_on_ride',
          fields: { occupantId: complaintMessages.occupantId },
        },
        400,
      );
    case 'self':
      return json(
        {
          error: 'Check the highlighted fields.',
          code: 'invalid',
          fields: { occupantId: 'You cannot file a complaint about yourself.' },
        },
        400,
      );
    case 'message_not_found':
      return json(
        {
          error: 'Check the highlighted fields.',
          code: 'invalid',
          fields: { messageId: complaintMessages.messageId },
        },
        400,
      );
    case 'window':
      return json({ error: windowRefusals[result.window], code: 'window_closed' }, 409);
    case 'already_filed':
      return json(
        {
          error: `You already filed complaint ${result.reference} about this person on this ride.`,
          code: 'already_filed',
          reference: result.reference,
        },
        409,
      );
    case 'daily_limit':
      return json(
        {
          error: 'You can file at most 5 complaints in 24 hours. Try again later.',
          code: 'daily_limit',
        },
        429,
      );
  }
}

/**
 * POST /api/rides/[id]/complaints (FR-RD-13.1 to 13.4, FR-RD-09.6, CS455-52): someone on a
 * ride files a complaint about another person on it. Body
 * { occupantId, category, description, messageId? }, where occupantId is that person's seat.
 * 201 { reference }. A suspended rider can still file one (FR-RD-01.5). The answer never
 * names the person complained about, and they are never told (FR-RD-13.3).
 */
export async function POST(req: Request, ctx: RouteContext<'/api/rides/[id]/complaints'>) {
  const blocked = await guard('file-complaint', 20, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);

  const parsed = parseComplaintRequest(await readJson(req));
  if (!parsed.ok) {
    return json(
      { error: 'Check the highlighted fields.', code: 'invalid', fields: parsed.errors },
      400,
    );
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await fileComplaint(client, id, user.id, parsed.value, new Date());
    if (result.kind !== 'filed') {
      await client.query('ROLLBACK');
      return refuse(result);
    }
    await client.query('COMMIT');
    client.release();
    client = null;
    try {
      await analyzeComplaint(result.id);
    } catch (error) {
      // The complaint is already committed; an analysis-storage failure must not undo filing.
      console.error('Complaint AI analysis could not be recorded:', error);
    }
    return json({ reference: result.reference }, 201);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('File complaint failed:', error);
    return json(
      {
        error: 'Your complaint could not be saved. Nothing was sent; try again.',
        code: 'server_error',
      },
      500,
    );
  } finally {
    client?.release();
  }
}
