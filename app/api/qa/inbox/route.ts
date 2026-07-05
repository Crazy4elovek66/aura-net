import { createOpsEvent } from "@/lib/server/ops-events";
import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";

interface ProfileResponse {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface QuestionDbRow {
  id: string;
  text: string;
  is_anonymous: boolean;
  created_at: string;
  sender_id: string | null;
  profiles: ProfileResponse | null;
}

export async function GET(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `qa-inbox:ip:${getRequestIp(request)}`,
    limit: 10,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком частые запросы. Подожди немного.", burstLimit);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildApiErrorResponse(401, API_ERROR_MESSAGES.unauthorized, {
      code: "UNAUTHORIZED",
    });
  }

  // Проверяем, является ли текущий пользователь платформенным админом
  const { data: adminCheck } = await supabase.rpc("is_platform_admin");
  const isAdmin = Boolean(adminCheck);

  // Загружаем неотвеченные вопросы
  const { data: questions, error: questionsError } = await supabase
    .from("qa_questions")
    .select(`
      id,
      text,
      is_anonymous,
      created_at,
      sender_id,
      profiles:profiles!sender_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("receiver_id", user.id)
    .eq("is_answered", false)
    .order("created_at", { ascending: false });

  if (questionsError) {
    await createOpsEvent({
      level: "error",
      scope: "qa",
      eventType: "fetch_qa_inbox_failed",
      profileId: user.id,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: questionsError.message,
    });

    return buildApiErrorResponse(500, "Не удалось загрузить список входящих вопросов.", {
      code: "FETCH_QA_INBOX_FAILED",
    });
  }

  const dbRows = (questions || []) as unknown as QuestionDbRow[];

  // Форматируем данные, скрывая отправителя для анонимных вопросов
  const formattedQuestions = dbRows.map((q) => {
    // Владельцу профиля анонимные отправители НЕ показываются,
    // но администраторам (при необходимости) мы можем показать.
    // Для безопасности по умолчанию скрываем для всех, кроме глобального админа.
    const showSender = !q.is_anonymous || isAdmin;

    return {
      id: q.id,
      text: q.text,
      isAnonymous: q.is_anonymous,
      createdAt: q.created_at,
      sender: showSender && q.profiles ? {
        username: q.profiles.username,
        displayName: q.profiles.display_name || q.profiles.username,
        avatarUrl: q.profiles.avatar_url,
      } : null,
    };
  });

  return buildApiSuccessResponse({
    questions: formattedQuestions,
  });
}
