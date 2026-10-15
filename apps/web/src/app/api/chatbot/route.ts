import { randomUUID } from 'node:crypto';
import { getCurrentUser, guard, json, rateLimit, readJson } from '../../../lib/auth';
import { routes } from '../../../lib/routes';
import {
  processChatbotMessage,
  MAX_MESSAGE_LENGTH,
  type ChatbotAgentMetadata,
} from '../../../lib/ai/chatbot';
import {
  CHATBOT_GEMINI_TIMEOUT_MS,
  CHATBOT_GEMINI_MODEL_VERSION,
  CHATBOT_GEMINI_PROMPT_VERSION,
} from '../../../lib/ai/chatbot-gemini';
import { getRideFormOptions } from '../../../lib/ride-options';
import { logChatbotAudit, type ChatbotToolAudit } from '../../../lib/ai/chatbot-audit';

export const CHATBOT_HOURLY_LIMIT = 20; // AI-RD-09: 20 AI requests/hr per rider
export const CHATBOT_TIMEOUT_MS = CHATBOT_GEMINI_TIMEOUT_MS * 2 + 1_000;

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
      validationOutcome: 'rate_limit_exceeded',
      fallbackUsed: true,
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
    const aiMetadataRef: { current: ChatbotAgentMetadata | null } = { current: null };
    let timeoutTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error('CHATBOT_TIMEOUT')), CHATBOT_TIMEOUT_MS);
    });

    const processRequest = async () => {
      const rideOptions = await getRideFormOptions().catch((error: unknown) => {
        console.error('Failed to load configured chatbot options; using parser defaults.', error);
        return undefined;
      });
      return processChatbotMessage(user.id, rawMessage.trim(), {
        rideOptions,
        useGemini: true,
        onAiMetadata: (metadata) => {
          aiMetadataRef.current = metadata;
        },
      });
    };

    const response = await Promise.race([processRequest(), timeoutPromise]).finally(() => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    });

    const aiMetadata = aiMetadataRef.current;
    const latencyMs = Date.now() - startTime;

    // Derive executed tool for audit logging (AI-RD-12)
    const toolCalls: ChatbotToolAudit[] = aiMetadata?.toolCalls ?? [];
    let validationOutcome = 'valid';
    let fallbackUsed = false;

    if (!aiMetadata?.modelAttempted && response.kind === 'search_results') {
      toolCalls.push({
        tool: 'search_rides',
        arguments: {
          hubId: response.interpretedFilters.hubId,
          direction: response.interpretedFilters.direction,
          departureStart: response.interpretedFilters.departureStart,
          departureEnd: response.interpretedFilters.departureEnd,
          vehicleTypeId: response.interpretedFilters.vehicleTypeId,
          maxFareShare: response.interpretedFilters.maxFareShare,
        },
        resultSize: response.rides.length,
        success: true,
      });
      validationOutcome = 'valid';
    } else if (!aiMetadata?.modelAttempted && response.kind === 'public_profile') {
      toolCalls.push({
        tool: 'get_public_profile',
        arguments: {
          displayName: response.profile.displayName,
        },
        resultSize: 1,
        success: true,
      });
      validationOutcome = 'valid';
    } else if (!aiMetadata?.modelAttempted && response.kind === 'preference_proposal') {
      toolCalls.push({
        tool: 'propose_preference_update',
        arguments: {
          changes: response.proposal.changes,
        },
        resultSize: Object.keys(response.proposal.changes ?? {}).length,
        success: true,
      });
      validationOutcome = 'valid';
    } else if (!aiMetadata?.modelAttempted && response.kind === 'clarification') {
      validationOutcome = response.missingField
        ? `needs_clarification_${response.missingField}`
        : 'needs_clarification';
    } else if (!aiMetadata?.modelAttempted && response.kind === 'prohibited_action') {
      validationOutcome = `prohibited_action_${response.actionType}`;
      fallbackUsed = true;
    } else if (!aiMetadata?.modelAttempted && response.kind === 'out_of_scope') {
      validationOutcome = 'out_of_scope';
    } else if (!aiMetadata?.modelAttempted && response.kind === 'service_unavailable') {
      validationOutcome = 'service_unavailable';
      fallbackUsed = true;
    }

    if (aiMetadata?.modelAttempted) {
      validationOutcome = aiMetadata.validationOutcome;
      fallbackUsed = aiMetadata.fallbackUsed;
    }

    await logChatbotAudit({
      requestId,
      userId: user.id,
      modelVersion: aiMetadata?.modelVersion ?? CHATBOT_GEMINI_MODEL_VERSION,
      promptVersion: aiMetadata?.promptVersion ?? CHATBOT_GEMINI_PROMPT_VERSION,
      outcome: response.kind,
      validationOutcome,
      fallbackUsed,
      toolCalls,
      latencyMs,
      inputTokens: aiMetadata?.inputTokens,
      outputTokens: aiMetadata?.outputTokens,
    });

    return json({
      ...response,
      requestId,
      aiGenerated: Boolean(aiMetadata?.modelAttempted && !aiMetadata.fallbackUsed),
      aiFallback: Boolean(aiMetadata?.fallbackUsed),
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.message === 'CHATBOT_TIMEOUT';

    await logChatbotAudit({
      requestId,
      userId: user.id,
      modelVersion: CHATBOT_GEMINI_MODEL_VERSION,
      promptVersion: CHATBOT_GEMINI_PROMPT_VERSION,
      outcome: isTimeout ? 'timeout' : 'error',
      validationOutcome: isTimeout ? 'timeout' : 'internal_error',
      fallbackUsed: true,
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
