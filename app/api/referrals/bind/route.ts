import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function normalizeCode(value: string) {
  return value.startsWith("ref_") ? value.slice(4) : value;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let payload: { code?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const code = typeof payload.code === "string" ? normalizeCode(payload.code.trim()) : "";
  if (!code) {
    return NextResponse.json({ success: true, skipped: true, reason: "missing_code" });
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
    return NextResponse.json({ error: "Не удалось привязать приглашение" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ...(data || {}),
  });
}
