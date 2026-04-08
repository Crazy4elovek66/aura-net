import { RESONANCE_SPECIAL_CARD } from "@/lib/special-card";
import { createOpsEvent } from "@/lib/server/ops-events";
import { consumePersistentRateLimit, consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";

type Mode = "assign" | "remove";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `admin-special-card:ip:${getRequestIp(request)}`,
    limit: 6,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много чувствительных admin-запросов. Подожди несколько секунд.", burstLimit);
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

  const userLimit = await consumePersistentRateLimit({
    key: `admin-special-card:user:${user.id}`,
    limit: 4,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много чувствительных admin-запросов. Подожди несколько секунд.", userLimit);
  }

  let body: { profileId?: unknown; mode?: unknown };

  try {
    body = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  const mode: Mode | null = body.mode === "assign" || body.mode === "remove" ? body.mode : null;

  if (!profileId || !mode || !UUID_RE.test(profileId)) {
    return buildApiErrorResponse(400, "Некорректные данные запроса.", {
      code: "INVALID_SPECIAL_CARD_REQUEST",
    });
  }

  const nextSpecialCard = mode === "assign" ? RESONANCE_SPECIAL_CARD : null;

  const { error: rpcError } = await supabase.rpc("set_profile_special_card", {
    p_target_id: profileId,
    p_special_card: nextSpecialCard,
  });

  if (rpcError) {
    await createOpsEvent({
      level: "error",
      scope: "admin",
      eventType: "special_card_update_failed",
      actorId: user.id,
      profileId,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: rpcError.message,
      payload: {
        mode,
      },
    });
    const message = rpcError.message || "";
    const normalized = message.toLowerCase();

    if (normalized.includes("not authenticated")) {
      return buildApiErrorResponse(401, API_ERROR_MESSAGES.unauthorized, {
        code: "UNAUTHORIZED",
      });
    }

    if (normalized.includes("only platform admins")) {
      return buildApiErrorResponse(403, API_ERROR_MESSAGES.forbidden, {
        code: "FORBIDDEN",
      });
    }

    if (normalized.includes("profile not found")) {
      return buildApiErrorResponse(404, "Профиль не найден.", {
        code: "PROFILE_NOT_FOUND",
      });
    }

    console.error("[Admin SpecialCard API] RPC error:", rpcError);
    return buildApiErrorResponse(500, "Не удалось обновить специальный статус.", {
      code: "SPECIAL_CARD_UPDATE_FAILED",
    });
  }

  return buildApiSuccessResponse({
    specialCard: nextSpecialCard,
  });
}
