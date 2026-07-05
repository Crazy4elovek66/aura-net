import { createOpsEvent } from "@/lib/server/ops-events";
import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
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

interface LikeResponse {
  user_id: string;
}

interface AnswerResponse {
  id: string;
  text: string;
  media_type: string;
  media_file_id: string | null;
  created_at: string;
  qa_answer_likes: LikeResponse[];
}

interface QuestionDbRow {
  id: string;
  text: string;
  is_anonymous: boolean;
  created_at: string;
  sender_id: string | null;
  profiles: ProfileResponse | null;
  qa_answers: AnswerResponse[] | AnswerResponse | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim();

  if (!username) {
    return buildApiErrorResponse(400, "Не указан username получателя.", {
      code: "USERNAME_REQUIRED",
    });
  }

  const burstLimit = consumeRateLimit({
    key: `qa-list:ip:${getRequestIp(request)}`,
    limit: 15,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком частые запросы. Подожди немного.", burstLimit);
  }

  const supabase = await createClient();

  // Находим id пользователя по username
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (profileError || !profile) {
    return buildApiErrorResponse(404, "Профиль не найден.", {
      code: "PROFILE_NOT_FOUND",
    });
  }

  const targetProfileId = profile.id;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Проверяем, является ли текущий пользователь платформенным админом
  let isAdmin = false;
  if (user) {
    const { data: adminCheck } = await supabase.rpc("is_platform_admin");
    isAdmin = Boolean(adminCheck);
  }

  // Загружаем отвеченные вопросы и ответы
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
      ),
      qa_answers (
        id,
        text,
        media_type,
        media_file_id,
        created_at,
        qa_answer_likes (
          user_id
        )
      )
    `)
    .eq("receiver_id", targetProfileId)
    .eq("is_answered", true)
    .order("created_at", { ascending: false });

  if (questionsError) {
    await createOpsEvent({
      level: "error",
      scope: "qa",
      eventType: "fetch_qa_list_failed",
      profileId: targetProfileId,
      actorId: user?.id || null,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: questionsError.message,
    });

    return buildApiErrorResponse(500, "Не удалось загрузить ленту Q&A.", {
      code: "FETCH_QA_LIST_FAILED",
    });
  }

  const dbRows = (questions || []) as unknown as QuestionDbRow[];

  // Форматируем данные для отправки клиенту
  const formattedQuestions = dbRows.map((q) => {
    const showSender = !q.is_anonymous || isAdmin;
    
    let answer: AnswerResponse | null = null;
    if (q.qa_answers) {
      if (Array.isArray(q.qa_answers)) {
        answer = q.qa_answers[0] || null;
      } else {
        answer = q.qa_answers as AnswerResponse;
      }
    }

    let formattedAnswer = null;
    if (answer) {
      const likesCount = answer.qa_answer_likes?.length || 0;
      const hasLiked = user
        ? answer.qa_answer_likes?.some((like) => like.user_id === user.id)
        : false;

      formattedAnswer = {
        id: answer.id,
        text: answer.text,
        mediaType: answer.media_type,
        mediaFileId: answer.media_file_id,
        createdAt: answer.created_at,
        likesCount,
        hasLiked,
      };
    }

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
      answer: formattedAnswer,
    };
  });

  return buildApiSuccessResponse({
    questions: formattedQuestions,
  });
}
