import { RESONANCE_SPECIAL_CARD } from "@/lib/special-card";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Mode = "assign" | "remove";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { profileId?: unknown; mode?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  const mode: Mode | null = body.mode === "assign" || body.mode === "remove" ? body.mode : null;

  if (!profileId || !mode || !UUID_RE.test(profileId)) {
    return NextResponse.json({ error: "Некорректные данные запроса" }, { status: 400 });
  }

  const nextSpecialCard = mode === "assign" ? RESONANCE_SPECIAL_CARD : null;

  const { error: rpcError } = await supabase.rpc("set_profile_special_card", {
    p_target_id: profileId,
    p_special_card: nextSpecialCard,
  });

  if (rpcError) {
    const message = rpcError.message || "";
    const normalized = message.toLowerCase();

    if (normalized.includes("not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (normalized.includes("only platform admins")) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    if (normalized.includes("profile not found")) {
      return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    }

    console.error("[Admin SpecialCard API] RPC error:", rpcError);
    return NextResponse.json({ error: "Не удалось обновить специальный статус" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    specialCard: nextSpecialCard,
  });
}
