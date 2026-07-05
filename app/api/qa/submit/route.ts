import { ANONYMOUS_QUESTION_COST } from "@/lib/economy";
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
import { createAdminClient } from "@/lib/supabase/admin";
import { drainRuntimeReliabilityWork } from "@/lib/server/runtime-reliability";

interface SubmitQuestionResult {
  question_id?: string | null;
  aura_left?: number | null;
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `qa-submit:ip:${getRequestIp(request)}`,
    limit: 5,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток отправить вопрос. Подожди немного.", burstLimit);
  }

  const supabase = await createClient();
  let payload: { receiverId?: string; text?: string; isAnonymous?: boolean };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const receiverId = typeof payload.receiverId === "string" ? payload.receiverId.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const isAnonymous = Boolean(payload.isAnonymous);

  if (!receiverId) {
    return buildApiErrorResponse(400, "Не указан receiverId.", {
      code: "RECEIVER_ID_REQUIRED",
    });
  }

  if (!text) {
    return buildApiErrorResponse(400, "Текст вопроса не может быть пустым.", {
      code: "TEXT_REQUIRED",
    });
  }

  if (text.length > 1000) {
    return buildApiErrorResponse(400, "Текст вопроса превышает 1000 символов.", {
      code: "TEXT_TOO_LONG",
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

  // Проверка блокировки отправителя
  const senderModeration = await getProfileModerationState(user.id);
  if (isProfileLimited(senderModeration)) {
    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  // Проверка блокировки получателя
  const receiverModeration = await getProfileModerationState(receiverId);
  if (isProfileLimited(receiverModeration)) {
    return buildApiErrorResponse(403, "Профиль получателя ограничен. Нельзя задать ему вопрос.", {
      code: "RECEIVER_LIMITED",
    });
  }

  const { data, error } = await supabase.rpc("submit_question", {
    p_receiver_id: receiverId,
    p_text: text,
    p_is_anonymous: isAnonymous,
  }).single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "qa",
      eventType: "submit_question_failed",
      profileId: receiverId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
      },
    });

    if (error.message.includes("Insufficient aura")) {
      return buildApiErrorResponse(403, `Недостаточно ауры для отправки анонимного вопроса. Требуется ${ANONYMOUS_QUESTION_COST} очков.`, {
        code: "INSUFFICIENT_AURA",
      });
    }

    return buildApiErrorResponse(500, "Не удалось отправить вопрос.", {
      code: "SUBMIT_QUESTION_FAILED",
    });
  }

  const row = (data || {}) as SubmitQuestionResult;

  if (row.question_id) {
    const admin = createAdminClient();
    let senderUsername: string | null = null;
    if (!isAnonymous) {
      const { data: senderProfile } = await admin
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      senderUsername = senderProfile?.username || null;
    }

    const notificationResult = await admin.rpc("enqueue_notification_event", {
      p_profile_id: receiverId,
      p_event_type: "new_question",
      p_payload: {
        questionId: row.question_id,
        isAnonymous,
        senderUsername,
      },
      p_dedupe_key: `qa-new-question:${receiverId}:${row.question_id}`,
      p_channel: "telegram",
    });

    if (notificationResult.error) {
      console.error("[QA Submit API] Failed to enqueue question notification:", notificationResult.error.message);
    } else {
      // Запускаем фоновый слив очереди без блокировки ответа клиенту
      drainRuntimeReliabilityWork({ source: "qa-new-question" }).catch((err) => {
        console.error("[QA Submit API] Async drain failed:", err);
      });
    }
  }

  return buildApiSuccessResponse({
    questionId: row.question_id ?? null,
    auraLeft: typeof row.aura_left === "number" ? row.aura_left : null,
  });
}
