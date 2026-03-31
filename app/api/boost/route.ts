import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
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
    return NextResponse.json({ error: "Only the owner can boost their profile" }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("aura_points")
    .eq("id", profileId)
    .single();

  if (profileError) {
    return NextResponse.json({ error: "Не удалось получить профиль" }, { status: 500 });
  }

  if ((profile?.aura_points || 0) < 200) {
    return NextResponse.json({ error: "Недостаточно ауры для буста (нужно 200)" }, { status: 403 });
  }

  const { error: auraDeductError } = await supabase.rpc("increment_aura", {
    target_id: profileId,
    amount: -200,
  });

  if (auraDeductError) {
    return NextResponse.json({ error: "Ошибка списания ауры" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { data: boostRow, error: boostInsertError } = await supabase
    .from("boosts")
    .insert({
      profile_id: profileId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (boostInsertError) {
    await admin.rpc("increment_aura", { target_id: profileId, amount: 200 });
    return NextResponse.json({ error: "Не удалось активировать буст" }, { status: 500 });
  }

  if (!boostRow) {
    await admin.rpc("increment_aura", { target_id: profileId, amount: 200 });
    return NextResponse.json({ error: "Не удалось создать запись буста" }, { status: 500 });
  }

  const { error: transactionError } = await supabase.from("transactions").insert({
    user_id: user.id,
    amount: -200,
    type: "boost",
    description: "Активация буста профиля (15 минут)",
    metadata: {
      source: "boost",
      boostId: boostRow.id,
      durationMinutes: 15,
    },
  });

  if (transactionError) {
    await admin.from("boosts").delete().eq("id", boostRow.id);
    await admin.rpc("increment_aura", { target_id: profileId, amount: 200 });
    return NextResponse.json({ error: "Не удалось записать буст в историю" }, { status: 500 });
  }

  return NextResponse.json({ success: true, expiresAt });
}

