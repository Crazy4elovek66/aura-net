import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationState, isProfileLimited } from "@/lib/server/profile-moderation";
import { consumePersistentRateLimit, consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  buildApiErrorResponse,
  buildApiSuccessResponse,
  API_ERROR_MESSAGES,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { normalizeReferralCode } from "@/lib/auth/telegram-auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `referrals-bind:ip:${getRequestIp(request)}`,
    limit: 10,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток привязать инвайт. Подожди несколько секунд.", burstLimit);
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
      scope: "referrals",
      eventType: "limited_profile_bind_blocked",
      profileId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: "Referral bind blocked because profile is limited",
    });

    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  const userLimit = await consumePersistentRateLimit({
    key: `referrals-bind:user:${user.id}`,
    limit: 4,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток привязать инвайт. Подожди несколько секунд.", userLimit);
  }

  let payload: { code?: unknown };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const code = typeof payload.code === "string" ? normalizeReferralCode(payload.code) || "" : "";
  if (!code) {
    return buildApiSuccessResponse({
      skipped: true,
      reason: "missing_code",
    });
  }

  const { data, error } = await supabase
    .rpc("bind_profile_referral", {
      p_invitee_id: user.id,
      p_invite_code: code,
      p_context: {
        source: "bind_route",
      },
    })
    .single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "referrals",
      eventType: "referral_bind_failed",
      profileId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    });

    console.error("[Referral Bind API] Failed to bind referral", error.message);
    return buildApiErrorResponse(500, "Не удалось привязать приглашение.", {
      code: "REFERRAL_BIND_FAILED",
    });
  }

  return buildApiSuccessResponse({
    ...(data || {}),
  });
}
