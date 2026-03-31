import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Не удалось проверить профиль" }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  const { data, error } = await admin
    .rpc("claim_daily_reward", { p_profile_id: user.id })
    .single();

  if (error) {
    const dbMessage = typeof error.message === "string" ? error.message : "";
    const normalized = dbMessage.toLowerCase();
    const notFound = normalized.includes("profile not found");
    const fnMissing = normalized.includes("claim_daily_reward") && normalized.includes("function");
    const permissionError = normalized.includes("permission denied");

    console.error("[DailyReward API] claim_daily_reward failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return NextResponse.json(
      {
        error: notFound
          ? "Профиль не найден"
          : fnMissing
            ? "Функция daily reward не найдена в БД. Примени актуальный schema.sql."
            : permissionError
              ? "Недостаточно прав на выполнение daily reward."
              : dbMessage || "Не удалось получить daily reward",
      },
      { status: notFound ? 404 : fnMissing ? 501 : permissionError ? 403 : 500 },
    );
  }

  const rewardRow = (data || {}) as {
    claimed?: boolean;
    reward?: number;
    streak?: number;
    next_reward?: number;
    last_reward_at?: string | null;
    available_at?: string | null;
  };

  return NextResponse.json({
    success: true,
    claimed: Boolean(rewardRow.claimed),
    reward: Number(rewardRow.reward || 0),
    streak: Number(rewardRow.streak || 0),
    nextReward: Number(rewardRow.next_reward || 0),
    lastRewardAt: rewardRow.last_reward_at ?? null,
    availableAt: rewardRow.available_at ?? null,
  });
}
