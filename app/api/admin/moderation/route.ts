import { consumePersistentRateLimit, consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { createOpsEvent } from "@/lib/server/ops-events";
import { createClient } from "@/lib/supabase/server";

type ModerationAction =
  | "limit"
  | "restore"
  | "hide_discover"
  | "show_discover"
  | "hide_leaderboards"
  | "show_leaderboards";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getPatch(action: ModerationAction) {
  switch (action) {
    case "limit":
      return { p_is_limited: true };
    case "restore":
      return { p_is_limited: false };
    case "hide_discover":
      return { p_hide_from_discover: true };
    case "show_discover":
      return { p_hide_from_discover: false };
    case "hide_leaderboards":
      return { p_hide_from_leaderboards: true };
    case "show_leaderboards":
      return { p_hide_from_leaderboards: false };
  }
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `admin-moderation:ip:${getRequestIp(request)}`,
    limit: 10,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много модераторских запросов. Подожди несколько секунд.", burstLimit);
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
    key: `admin-moderation:user:${user.id}`,
    limit: 8,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много модераторских запросов. Подожди несколько секунд.", userLimit);
  }

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) {
    return buildApiErrorResponse(403, API_ERROR_MESSAGES.forbidden, {
      code: "FORBIDDEN",
    });
  }

  let body: {
    profileId?: unknown;
    action?: unknown;
    reason?: unknown;
    note?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  const action =
    body.action === "limit" ||
    body.action === "restore" ||
    body.action === "hide_discover" ||
    body.action === "show_discover" ||
    body.action === "hide_leaderboards" ||
    body.action === "show_leaderboards"
      ? (body.action as ModerationAction)
      : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!profileId || !UUID_RE.test(profileId) || !action) {
    return buildApiErrorResponse(400, "Некорректный запрос модерации.", {
      code: "INVALID_MODERATION_REQUEST",
    });
  }

  const { data, error } = await supabase.rpc("set_profile_moderation_state", {
    p_profile_id: profileId,
    p_reason: reason || null,
    p_note: note || null,
    ...getPatch(action),
  });

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "admin",
      eventType: "moderation_update_failed",
      actorId: user.id,
      profileId,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message || "Failed to update moderation state",
      payload: {
        action,
        reason,
      },
    });

    const normalized = (error.message || "").toLowerCase();
    if (normalized.includes("only platform admins")) {
      return buildApiErrorResponse(403, API_ERROR_MESSAGES.forbidden, {
        code: "FORBIDDEN",
      });
    }

    return buildApiErrorResponse(500, "Не удалось обновить состояние модерации.", {
      code: "MODERATION_UPDATE_FAILED",
    });
  }

  await createOpsEvent({
    level: "warn",
    scope: "admin",
    eventType: "moderation_update_requested",
    actorId: user.id,
    profileId,
    requestPath: new URL(request.url).pathname,
    requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
    message: `Admin action applied: ${action}`,
    payload: {
      action,
      reason,
      rowCount: Array.isArray(data) ? data.length : null,
    },
  });

  return buildApiSuccessResponse({
    state: Array.isArray(data) ? data[0] || null : null,
  });
}
