import { RESONANCE_SPECIAL_CARD } from "@/lib/special-card";
import { createOpsEvent } from "@/lib/server/ops-events";
import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import { buildRateLimitResponse } from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userLimit = consumeRateLimit({
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
