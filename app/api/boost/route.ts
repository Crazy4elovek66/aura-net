import { BOOST_COST, BOOST_DURATION_MINUTES } from "@/lib/economy";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationState, isProfileLimited } from "@/lib/server/profile-moderation";
import { consumePersistentRateLimit, consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { invalidateRuntimeCache } from "@/lib/server/runtime-cache";
import { createClient } from "@/lib/supabase/server";

interface ActivateBoostRow {
  boost_id?: string | null;
  expires_at?: string | null;
  aura_left?: number | null;
}

function mapBoostRpcError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("insufficient aura")) {
    return {
      status: 403,
      code: "INSUFFICIENT_AURA",
      error: `Недостаточно ауры для фокуса. Нужно ${BOOST_COST}.`,
    };
  }

  if (normalized.includes("boost already active")) {
    return {
      status: 429,
      code: "BOOST_ALREADY_ACTIVE",
      error: "Фокус уже активен. Дождись окончания текущего.",
    };
  }

  if (normalized.includes("profile not found")) {
    return {
      status: 404,
      code: "PROFILE_NOT_FOUND",
      error: "Профиль не найден.",
    };
  }

  if (normalized.includes("not allowed")) {
    return {
      status: 403,
      code: "FORBIDDEN",
      error: "Только владелец профиля может включить фокус.",
    };
  }

  if (normalized.includes("function") && normalized.includes("does not exist")) {
    return {
      status: 501,
      code: "FUNCTION_MISSING",
      error: "Функция активации фокуса не найдена. Примени актуальные миграции.",
    };
  }

  return {
    status: 500,
    code: "BOOST_CREATE_FAILED",
    error: "Не удалось активировать фокус.",
  };
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `boost:ip:${getRequestIp(request)}`,
    limit: 8,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток включить фокус. Подожди несколько секунд.", burstLimit);
  }

  const supabase = await createClient();
  let payload: { profileId?: unknown };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const profileId = typeof payload.profileId === "string" ? payload.profileId.trim() : "";

  if (!profileId) {
    return buildApiErrorResponse(400, "Не указан profileId.", {
      code: "PROFILE_ID_REQUIRED",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== profileId) {
    return buildApiErrorResponse(403, "Только владелец профиля может включить фокус.", {
      code: "FORBIDDEN",
    });
  }

  const moderationState = await getProfileModerationState(user.id);
  if (isProfileLimited(moderationState)) {
    await createOpsEvent({
      level: "warn",
      scope: "boost",
      eventType: "limited_profile_boost_blocked",
      profileId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: "Boost activation blocked because profile is limited",
    });

    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  const userLimit = await consumePersistentRateLimit({
    key: `boost:user:${user.id}`,
    limit: 3,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток включить фокус. Подожди несколько секунд.", userLimit);
  }

  const { data, error } = await supabase
    .rpc("activate_profile_boost", {
      p_profile_id: profileId,
      p_cost: BOOST_COST,
      p_duration_minutes: BOOST_DURATION_MINUTES,
    })
    .single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "boost",
      eventType: "boost_activation_failed",
      profileId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    });

    const mapped = mapBoostRpcError(error.message || "");
    return buildApiErrorResponse(mapped.status, mapped.error, {
      code: mapped.code,
    });
  }

  const row = (data || {}) as ActivateBoostRow;

  invalidateRuntimeCache([
    "leaderboard-full:v2",
    "leaderboard-preview:v2",
    "discover:v2",
    "landing-stats:v2",
  ]);

  return buildApiSuccessResponse({
    expiresAt: row.expires_at ?? null,
    auraLeft: Number(row.aura_left || 0),
  });
}
