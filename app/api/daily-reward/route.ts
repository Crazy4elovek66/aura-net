import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface ClaimDailyRewardRow {
  claimed?: boolean;
  reward?: number;
  streak?: number;
  next_reward?: number;
  last_reward_at?: string | null;
  available_at?: string | null;
  base_reward?: number;
  bonus_reward?: number;
  streak_milestone_reward?: number;
  weekly_reward?: number;
  achievement_reward?: number;
  unlocked_achievements?: string[] | null;
}

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: "Не удалось проверить сессию" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("claim_daily_reward", { p_profile_id: user.id }).single();

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
            ? "Функция ежедневной награды не найдена в БД. Примени актуальные миграции."
            : permissionError
              ? "Недостаточно прав для получения ежедневной награды."
              : dbMessage || "Не удалось получить ежедневную награду",
      },
      { status: notFound ? 404 : fnMissing ? 501 : permissionError ? 403 : 500 },
    );
  }

  const rewardRow = (data || {}) as ClaimDailyRewardRow;

  return NextResponse.json({
    success: true,
    claimed: Boolean(rewardRow.claimed),
    reward: Number(rewardRow.reward || 0),
    streak: Number(rewardRow.streak || 0),
    nextReward: Number(rewardRow.next_reward || 0),
    lastRewardAt: rewardRow.last_reward_at ?? null,
    availableAt: rewardRow.available_at ?? null,
    baseReward: Number(rewardRow.base_reward || 0),
    bonusReward: Number(rewardRow.bonus_reward || 0),
    bonuses: {
      streakMilestone: Number(rewardRow.streak_milestone_reward || 0),
      weeklyActivity: Number(rewardRow.weekly_reward || 0),
      achievements: Number(rewardRow.achievement_reward || 0),
    },
    unlockedAchievements: Array.isArray(rewardRow.unlocked_achievements)
      ? rewardRow.unlocked_achievements.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [],
  });
}
