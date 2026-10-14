import { randomUUID } from 'node:crypto';
import { getCurrentUser, guard, json, rateLimit, readJson } from '../../../lib/auth';
import { routes } from '../../../lib/routes';
import { processChatbotMessage, MAX_MESSAGE_LENGTH } from '../../../lib/ai/chatbot';
import { getRideFormOptions } from '../../../lib/ride-options';
import { logChatbotAudit, type ChatbotToolAudit } from '../../../lib/ai/chatbot-audit';

export const CHATBOT_HOURLY_LIMIT = 20; // AI-RD-09: 20 AI requests/hr per rider
export const CHATBOT_TIMEOUT_MS = 8000; // AI-RD-09: 8-second budget

export async function POST(req: Request) {
  const requestId = randomUUID();
  const startTime = Date.now();

  const blocked = await guard('chatbot-query', 60, 60);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) {
    return json({ error: 'Authentication required.' }, 401);
  }

  // 1. Rate limiting (AI-RD-09: 20 requests/hr per rider)
  const allowed = await rateLimit(`chatbot:rider:${user.id}`, CHATBOT_HOURLY_LIMIT, 3600);
  if (!allowed) {
    const latencyMs = Date.now() - startTime;
    await logChatbotAudit({
      requestId,
      userId: user.id,
      outcome: 'rate_limited',
      latencyMs,
    });
    return json(
      {
        error:
          'Hourly AI request limit reached (20 requests per hour). Please try manual ride search or wait before trying again.',
        rateLimited: true,
        fallbackLink: {
          href: routes.findRide,
          label: 'Manual Ride Search',
        },
      },
      429,
    );
  }

  // 2. Input validation (AI-RD-09, FR-RD-05.4: max 500 characters)
  const body = await readJson(req);
  const rawMessage = body.message;

  if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
    return json({ error: 'Message is required.' }, 400);
  }

  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    return json(
      {
        error: `Message exceeds the ${MAX_MESSAGE_LENGTH}-character limit (length: ${rawMessage.length}). Please shorten your message.`,
      },
      400,
    );
  }

  // 3. Execution with 8-second timeout budget (AI-RD-09)
  try {
    let timeoutTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error('CHATBOT_TIMEOUT')), CHATBOT_TIMEOUT_MS);
    });

    const rideOptions = await getRideFormOptions().catch(() => undefined);

    const response = await Promise.race([
      processChatbotMessage(user.id, rawMessage.trim(), { rideOptions }),
      timeoutPromise,
    ]).finally(() => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    });

    const latencyMs = Date.now() - startTime;

    // Derive executed tool for audit logging (AI-RD-12)
    const toolCalls: ChatbotToolAudit[] = [];
    if (response.kind === 'search_results') {
      toolCalls.push({ tool: 'search_rides', success: true });
    } else if (response.kind === 'public_profile') {
      toolCalls.push({ tool: 'get_public_profile', success: true });
    } else if (response.kind === 'preference_proposal') {
      toolCalls.push({ tool: 'propose_preference_update', success: true });
    }

    await logChatbotAudit({
      requestId,
      userId: user.id,
      outcome: response.kind,
      toolCalls,
      latencyMs,
    });

    return json({ ...response, requestId });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.message === 'CHATBOT_TIMEOUT';

    await logChatbotAudit({
      requestId,
      userId: user.id,
      outcome: isTimeout ? 'timeout' : 'error',
      latencyMs,
    });

    return json(
      {
        kind: 'service_unavailable',
        message: isTimeout
          ? 'The AI assistant timed out. You can find rides using manual search.'
          : 'The AI assistant is temporarily unavailable. You can find rides using manual search.',
        fallbackLink: {
          href: routes.findRide,
          label: 'Manual Ride Search',
        },
        requestId,
      },
      isTimeout ? 504 : 503,
    );
  }
}
