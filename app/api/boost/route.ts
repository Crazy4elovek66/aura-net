import { BOOST_COST, BOOST_DURATION_MINUTES } from "@/lib/economy";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationState, isProfileLimited } from "@/lib/server/profile-moderation";
import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import { buildRateLimitResponse } from "@/lib/server/route-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Ошибка конфигурации сервера" }, { status: 500 });
  }

  let payload: { profileId?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const profileId = typeof payload.profileId === "string" ? payload.profileId : "";

  if (!profileId) {
    return NextResponse.json({ error: "Не указан profileId" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== profileId) {
    return NextResponse.json({ error: "Только владелец может включить фокус" }, { status: 403 });
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

    return NextResponse.json({ error: "РџСЂРѕС„РёР»СЊ РІСЂРµРјРµРЅРЅРѕ РѕРіСЂР°РЅРёС‡РµРЅ" }, { status: 403 });
  }

  const userLimit = consumeRateLimit({
    key: `boost:user:${user.id}`,
    limit: 3,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток включить фокус. Подожди несколько секунд.", userLimit);
  }

  const nowIso = new Date().toISOString();

  const { data: activeBoost, error: activeBoostError } = await supabase
    .from("boosts")
    .select("expires_at")
    .eq("profile_id", profileId)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeBoostError) {
    return NextResponse.json({ error: "Не удалось проверить активный фокус" }, { status: 500 });
  }

  if (activeBoost?.expires_at) {
    return NextResponse.json(
      {
        error: "Фокус уже активен. Дождись окончания текущего.",
        cooldownUntil: activeBoost.expires_at,
      },
      { status: 429 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("aura_points")
    .eq("id", profileId)
    .single();

  if (profileError) {
    return NextResponse.json({ error: "Не удалось получить профиль" }, { status: 500 });
  }

  if ((profile?.aura_points || 0) < BOOST_COST) {
    return NextResponse.json({ error: `Недостаточно ауры для фокуса (нужно ${BOOST_COST})` }, { status: 403 });
  }

  const { error: auraDeductError } = await supabase.rpc("increment_aura", {
    target_id: profileId,
    amount: -BOOST_COST,
  });

  if (auraDeductError) {
    return NextResponse.json({ error: "Ошибка списания ауры" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + BOOST_DURATION_MINUTES * 60 * 1000).toISOString();

  const { data: boostRow, error: boostInsertError } = await supabase
    .from("boosts")
    .insert({
      profile_id: profileId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (boostInsertError) {
    await createOpsEvent({
      level: "error",
      scope: "boost",
      eventType: "boost_insert_failed",
      profileId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: boostInsertError.message,
    });
    await admin.rpc("increment_aura", { target_id: profileId, amount: BOOST_COST });
    return NextResponse.json({ error: "Не удалось активировать фокус" }, { status: 500 });
  }

  if (!boostRow) {
    await admin.rpc("increment_aura", { target_id: profileId, amount: BOOST_COST });
    return NextResponse.json({ error: "Не удалось создать запись фокуса" }, { status: 500 });
  }

  const { error: transactionError } = await supabase.from("transactions").insert({
    user_id: user.id,
    amount: -BOOST_COST,
    type: "spotlight",
    description: `Активация фокуса (${BOOST_DURATION_MINUTES} минут)`,
    metadata: {
      source: "spotlight",
      boostId: boostRow.id,
      durationMinutes: BOOST_DURATION_MINUTES,
    },
  });

  if (transactionError) {
    await createOpsEvent({
      level: "error",
      scope: "boost",
      eventType: "boost_transaction_failed",
      profileId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: transactionError.message,
      payload: {
        boostId: boostRow.id,
      },
    });
    await admin.from("boosts").delete().eq("id", boostRow.id);
    await admin.rpc("increment_aura", { target_id: profileId, amount: BOOST_COST });
    return NextResponse.json({ error: "Не удалось записать фокус в историю" }, { status: 500 });
  }

  return NextResponse.json({ success: true, expiresAt });
}
