import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { profileId } = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== profileId) {
    return NextResponse.json({ error: "Only the owner can boost their profile" }, { status: 403 });
  }

  // 1. Проверяем баланс
  const { data: profile } = await supabase.from("profiles").select("aura_points").eq("id", profileId).single();
  if ((profile?.aura_points || 0) < 200) {
    return NextResponse.json({ error: "Недостаточно ауры для буста (нужно 200)" }, { status: 403 });
  }

  // 2. Списываем ауру и добавляем буст
  const { error: boostError } = await supabase.rpc("increment_aura", {
    target_id: profileId,
    amount: -200
  });

  if (boostError) return NextResponse.json({ error: "Ошибка списания" }, { status: 500 });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await supabase.from("boosts").insert({
    profile_id: profileId,
    expires_at: expiresAt
  });

  await supabase.from("transactions").insert({
    user_id: user.id,
    amount: -200,
    type: 'boost',
    description: 'Активация буста профиля (15 мин)'
  });

  return NextResponse.json({ success: true, expiresAt });
}
