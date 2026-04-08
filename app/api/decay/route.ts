import { API_ERROR_MESSAGES, buildApiErrorResponse, buildApiSuccessResponse } from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildApiErrorResponse(401, API_ERROR_MESSAGES.unauthorized, {
      code: "UNAUTHORIZED",
    });
  }

  const { data, error } = await supabase.rpc("apply_daily_decay", {
    p_profile_id: user.id,
  });

  if (error) {
    return buildApiErrorResponse(500, "Не удалось применить угасание.", {
      code: "DECAY_FAILED",
    });
  }

  return buildApiSuccessResponse({ lost: Number(data || 0) });
}
