import { CARD_ACCENT_VARIANTS } from "@/lib/economy";
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

type AuraAction = "decay_shield" | "streak_save" | "card_accent";

interface DecayShieldRow {
  expires_at?: string | null;
  aura_left?: number | null;
}

interface StreakSaveRow {
  last_reward_at?: string | null;
  streak?: number | null;
  aura_left?: number | null;
  cooldown_until?: string | null;
}

interface CardAccentRow {
  effect_variant?: string | null;
  expires_at?: string | null;
  aura_left?: number | null;
}

function mapRpcError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("could not find the function") && normalized.includes("schema cache")) {
    return {
      status: 501,
      code: "FUNCTION_MISSING",
      error: "Функция не найдена в schema cache Supabase. Примени миграции и обнови кэш API.",
    };
  }

  if (normalized.includes("function") && normalized.includes("does not exist")) {
    return {
      status: 501,
      code: "FUNCTION_MISSING",
      error: "Функция не найдена в базе. Примени актуальные миграции.",
    };
  }

  if (normalized.includes("insufficient aura")) {
    return { status: 403, code: "INSUFFICIENT_AURA", error: "Недостаточно ауры." };
  }

  if (
    normalized.includes("already active") ||
    normalized.includes("on cooldown") ||
    normalized.includes("already active until")
  ) {
    return {
      status: 429,
      code: "ACTION_ON_COOLDOWN",
      error: "Эффект уже активен или ещё находится на перезарядке.",
    };
  }

  if (
    normalized.includes("one missed day") ||
    normalized.includes("no streak to rescue") ||
    normalized.includes("unsupported accent variant")
  ) {
    return {
      status: 400,
      code: "ACTION_PRECONDITION_FAILED",
      error: "Условия для этой траты сейчас не выполнены.",
    };
  }

  if (normalized.includes("not allowed")) {
    return { status: 403, code: "FORBIDDEN", error: API_ERROR_MESSAGES.forbidden };
  }

  if (normalized.includes("profile not found")) {
    return { status: 404, code: "PROFILE_NOT_FOUND", error: "Профиль не найден." };
  }

  return { status: 500, code: "AURA_ACTION_FAILED", error: message || "Не удалось выполнить трату ауры." };
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `aura-actions:ip:${getRequestIp(request)}`,
    limit: 10,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток выполнить трату. Подожди несколько секунд.", burstLimit);
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return buildApiErrorResponse(401, API_ERROR_MESSAGES.unauthorized, {
      code: "UNAUTHORIZED",
    });
  }

  const moderationState = await getProfileModerationState(user.id);
  if (isProfileLimited(moderationState)) {
    await createOpsEvent({
      level: "warn",
      scope: "aura_actions",
      eventType: "limited_profile_action_blocked",
      profileId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: "Aura action blocked because profile is limited",
    });

    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  const userLimit = await consumePersistentRateLimit({
    key: `aura-actions:user:${user.id}`,
    limit: 5,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток выполнить трату. Подожди несколько секунд.", userLimit);
  }

  let payload: { action?: unknown; variant?: unknown };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const action =
    payload.action === "decay_shield" || payload.action === "streak_save" || payload.action === "card_accent"
      ? (payload.action as AuraAction)
      : null;

  if (!action) {
    return buildApiErrorResponse(400, "Неизвестное действие.", {
      code: "UNKNOWN_ACTION",
    });
  }

  if (action === "decay_shield") {
    const { data, error } = await supabase
      .rpc("purchase_decay_shield", {
        p_profile_id: user.id,
      })
      .single();

    if (error) {
      await createOpsEvent({
        level: "error",
        scope: "aura_actions",
        eventType: "decay_shield_failed",
        profileId: user.id,
        requestPath: new URL(request.url).pathname,
        requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
        message: error.message,
      });
      const mapped = mapRpcError(error.message || "");
      return buildApiErrorResponse(mapped.status, mapped.error, { code: mapped.code });
    }

    const row = (data || {}) as DecayShieldRow;

    invalidateRuntimeCache([
      "leaderboard-full:v2",
      "leaderboard-preview:v2",
      "discover:v2",
      "landing-stats:v2",
    ]);

    return buildApiSuccessResponse({
      action,
      expiresAt: row.expires_at ?? null,
      auraLeft: Number(row.aura_left || 0),
    });
  }

  if (action === "streak_save") {
    const { data, error } = await supabase
      .rpc("rescue_streak_with_aura", {
        p_profile_id: user.id,
      })
      .single();

    if (error) {
      await createOpsEvent({
        level: "error",
        scope: "aura_actions",
        eventType: "streak_save_failed",
        profileId: user.id,
        requestPath: new URL(request.url).pathname,
        requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
        message: error.message,
      });
      const mapped = mapRpcError(error.message || "");
      return buildApiErrorResponse(mapped.status, mapped.error, { code: mapped.code });
    }

    const row = (data || {}) as StreakSaveRow;

    invalidateRuntimeCache([
      "leaderboard-full:v2",
      "leaderboard-preview:v2",
      "discover:v2",
      "landing-stats:v2",
    ]);

    return buildApiSuccessResponse({
      action,
      streak: Number(row.streak || 0),
      lastRewardAt: row.last_reward_at ?? null,
      cooldownUntil: row.cooldown_until ?? null,
      auraLeft: Number(row.aura_left || 0),
    });
  }

  const rawVariant = typeof payload.variant === "string" ? payload.variant.trim().toUpperCase() : "";
  const variant = CARD_ACCENT_VARIANTS.includes(rawVariant as (typeof CARD_ACCENT_VARIANTS)[number])
    ? (rawVariant as (typeof CARD_ACCENT_VARIANTS)[number])
    : null;

  if (!variant) {
    return buildApiErrorResponse(400, "Некорректный вариант акцента.", {
      code: "INVALID_ACCENT_VARIANT",
    });
  }

  const { data, error } = await supabase
    .rpc("purchase_card_accent", {
      p_profile_id: user.id,
      p_variant: variant,
    })
    .single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "aura_actions",
      eventType: "card_accent_failed",
      profileId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        variant,
      },
    });
    const mapped = mapRpcError(error.message || "");
    return buildApiErrorResponse(mapped.status, mapped.error, { code: mapped.code });
  }

  const row = (data || {}) as CardAccentRow;

  invalidateRuntimeCache([
    "leaderboard-full:v2",
    "leaderboard-preview:v2",
    "discover:v2",
    "landing-stats:v2",
  ]);

  return buildApiSuccessResponse({
    action,
    variant: row.effect_variant ?? variant,
    expiresAt: row.expires_at ?? null,
    auraLeft: Number(row.aura_left || 0),
  });
}
