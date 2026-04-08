import { buildApiErrorResponse, buildApiSuccessResponse, API_ERROR_MESSAGES } from "@/lib/server/route-response";
import { normalizeReferralCode } from "@/lib/auth/telegram-auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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
    console.error("[Referral Bind API] Failed to bind referral", error.message);
    return buildApiErrorResponse(500, "Не удалось привязать приглашение.", {
      code: "REFERRAL_BIND_FAILED",
    });
  }

  return buildApiSuccessResponse({
    ...(data || {}),
  });
}
