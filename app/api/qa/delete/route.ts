import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { questionId } = await request.json();
    if (!questionId) {
      return buildApiErrorResponse(400, "Не указан ID вопроса.", {
        code: "QUESTION_ID_REQUIRED",
      });
    }

    const rateLimitResult = consumeRateLimit({
      key: `qa-delete:ip:${getRequestIp(request)}`,
      limit: 10,
      windowMs: 10_000,
    });
    if (!rateLimitResult.allowed) {
      return buildRateLimitResponse("Слишком частые запросы. Подожди немного.", rateLimitResult);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return buildApiErrorResponse(401, "Вы должны быть авторизованы.", {
        code: "UNAUTHORIZED",
      });
    }

    // Удаляем вопрос из базы данных. RLS политика разрешает удаление только получателю (receiver_id = auth.uid())
    const { error } = await supabase
      .from("qa_questions")
      .delete()
      .eq("id", questionId)
      .eq("receiver_id", user.id);

    if (error) {
      console.error("[QA Delete API] Failed to delete question:", error.message);
      return buildApiErrorResponse(500, "Не удалось удалить вопрос из базы данных.", {
        code: "DELETE_FAILED",
      });
    }

    return buildApiSuccessResponse({
      deleted: true,
    });
  } catch (err) {
    console.error("[QA Delete API] Exception:", err);
    return buildApiErrorResponse(500, "Внутренняя ошибка сервера.", {
      code: "SERVER_ERROR",
    });
  }
}
