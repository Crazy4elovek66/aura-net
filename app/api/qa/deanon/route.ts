import { createOpsEvent } from "@/lib/server/ops-events";
import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";

interface DeanonResult {
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_telegram_id?: string | number | null;
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `qa-deanon:ip:${getRequestIp(request)}`,
    limit: 5,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком частые запросы. Подожди немного.", burstLimit);
  }

  const supabase = await createClient();
  let payload: { questionId?: string };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const questionId = typeof payload.questionId === "string" ? payload.questionId.trim() : "";

  if (!questionId) {
    return buildApiErrorResponse(400, "Не указан questionId.", {
      code: "QUESTION_ID_REQUIRED",
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

  // Проверяем, является ли пользователь администратором
  const { data: adminCheck, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError || !adminCheck) {
    return buildApiErrorResponse(403, "У вас нет прав для совершения этого действия.", {
      code: "FORBIDDEN",
    });
  }

  // Вызываем RPC
  const { data, error } = await supabase.rpc("deanon_question_by_admin", {
    p_question_id: questionId,
  }).maybeSingle();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "qa",
      eventType: "admin_deanon_failed",
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
      },
    });

    return buildApiErrorResponse(500, "Не удалось раскрыть автора вопроса.", {
      code: "DEANON_FAILED",
    });
  }

  const row = (data || {}) as DeanonResult;

  return buildApiSuccessResponse({
    username: row.sender_username ?? null,
    displayName: row.sender_display_name ?? null,
    telegramId: row.sender_telegram_id ? String(row.sender_telegram_id) : null,
  });
}
