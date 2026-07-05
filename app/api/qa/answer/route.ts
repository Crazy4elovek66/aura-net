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

interface AnswerQuestionResult {
  answer_id?: string | null;
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `qa-answer:ip:${getRequestIp(request)}`,
    limit: 5,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток отправить ответ. Подожди немного.", burstLimit);
  }

  const supabase = await createClient();
  let payload: { questionId?: string; text?: string; mediaType?: string; mediaFileId?: string };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const questionId = typeof payload.questionId === "string" ? payload.questionId.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const mediaType = typeof payload.mediaType === "string" ? payload.mediaType.trim() : "text";
  const mediaFileId = typeof payload.mediaFileId === "string" ? payload.mediaFileId.trim() : null;

  if (!questionId) {
    return buildApiErrorResponse(400, "Не указан questionId.", {
      code: "QUESTION_ID_REQUIRED",
    });
  }

  if (!text) {
    return buildApiErrorResponse(400, "Текст ответа не может быть пустым.", {
      code: "TEXT_REQUIRED",
    });
  }

  if (text.length > 4000) {
    return buildApiErrorResponse(400, "Текст ответа превышает 4000 символов.", {
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

  // Проверка блокировки отвечающего
  const moderationState = await getProfileModerationState(user.id);
  if (isProfileLimited(moderationState)) {
    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  const { data, error } = await supabase.rpc("answer_question", {
    p_question_id: questionId,
    p_text: text,
    p_media_type: mediaType,
    p_media_file_id: mediaFileId,
  }).single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "qa",
      eventType: "answer_question_failed",
      profileId: user.id,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
      },
    });

    return buildApiErrorResponse(500, "Не удалось опубликовать ответ.", {
      code: "ANSWER_QUESTION_FAILED",
    });
  }

  const row = (data || {}) as AnswerQuestionResult;

  if (row.answer_id) {
    const admin = createAdminClient();
    const { data: questionData } = await admin
      .from("qa_questions")
      .select("sender_id, receiver_id")
      .eq("id", questionId)
      .maybeSingle();

    if (questionData && questionData.sender_id) {
      const { data: replierProfile } = await admin
        .from("profiles")
        .select("username")
        .eq("id", questionData.receiver_id)
        .maybeSingle();

      const notificationResult = await admin.rpc("enqueue_notification_event", {
        p_profile_id: questionData.sender_id,
        p_event_type: "new_answer",
        p_payload: {
          questionId,
          answerId: row.answer_id,
          replierUsername: replierProfile?.username || null,
        },
        p_dedupe_key: `qa-new-answer:${questionData.sender_id}:${row.answer_id}`,
        p_channel: "telegram",
      });

      if (notificationResult.error) {
        console.error("[QA Answer API] Failed to enqueue answer notification:", notificationResult.error.message);
      } else {
        // Запускаем фоновый слив очереди без блокировки ответа клиенту
        drainRuntimeReliabilityWork({ source: "qa-new-answer" }).catch((err) => {
          console.error("[QA Answer API] Async drain failed:", err);
        });
      }
    }
  }

  return buildApiSuccessResponse({
    answerId: row.answer_id ?? null,
  });
}
