import { createClient } from "@/lib/supabase/client";

export async function checkAndApplyDecay(profileId: string) {
  const supabase = createClient();
  
  // 1. Получаем профиль
  const { data: profile } = await supabase
    .from("profiles")
    .select("aura_points, last_decay_at")
    .eq("id", profileId)
    .single();

  if (!profile) return;

  const lastDecay = new Date(profile.last_decay_at).getTime();
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  if (now - lastDecay >= dayInMs) {
    const daysPassed = Math.floor((now - lastDecay) / dayInMs);
    const newAura = Math.floor(profile.aura_points * Math.pow(0.97, daysPassed));
    const auraToLose = profile.aura_points - newAura;

    if (auraToLose > 0) {
      // Списываем ауру
      await supabase.rpc("increment_aura", {
        target_id: profileId,
        amount: -auraToLose
      });

      // Обновляем таймштамп
      await supabase
        .from("profiles")
        .update({ last_decay_at: new Date().toISOString() })
        .eq("id", profileId);

      // Логируем
      await supabase.from("transactions").insert({
        user_id: profileId,
        amount: -auraToLose,
        type: 'decay',
        description: `Daily decay (-3% per ${daysPassed} day(s))`
      });

      console.log(`[Decay] Deducted ${auraToLose} aura from ${profileId}`);
      return auraToLose;
    }
  }
  return 0;
}
