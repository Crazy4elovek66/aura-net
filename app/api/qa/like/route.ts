import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationState, isProfileLimited } from "@/lib/server/profile-moderation";
import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";

interface LikeAnswerResult {
  likes_count?: number | null;
  author_aura?: number | null;
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `qa-like:ip:${getRequestIp(request)}`,
    limit: 10,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком частые запросы. Подожди немного.", burstLimit);
  }

  const supabase = await createClient();
  let payload: { answerId?: string };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const answerId = typeof payload.answerId === "string" ? payload.answerId.trim() : "";

  if (!answerId) {
    return buildApiErrorResponse(400, "Не указан answerId.", {
      code: "ANSWER_ID_REQUIRED",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildApiErrorResponse(401, API_ERROR_MESSAGES.unauthorized, {
      code: "UNAUTHORIZED",
    });
  }

  // Проверка блокировки лайкающего
  const moderationState = await getProfileModerationState(user.id);
  if (isProfileLimited(moderationState)) {
    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  const { data, error } = await supabase.rpc("like_qa_answer", {
    p_answer_id: answerId,
  }).single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "qa",
      eventType: "like_answer_failed",
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
      },
    });

    if (error.message.includes("Cannot like your own answer")) {
      return buildApiErrorResponse(400, "Вы не можете лайкать собственный ответ.", {
        code: "CANNOT_LIKE_OWN_ANSWER",
      });
    }

    return buildApiErrorResponse(500, "Не удалось поставить лайк.", {
      code: "LIKE_ANSWER_FAILED",
    });
  }

  const row = (data || {}) as LikeAnswerResult;

  return buildApiSuccessResponse({
    likesCount: typeof row.likes_count === "number" ? row.likes_count : 0,
    authorAura: typeof row.author_aura === "number" ? row.author_aura : null,
  });
}
