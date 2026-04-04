import { createAdminClient } from "@/lib/supabase/admin";
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
  let admin: ReturnType<typeof createAdminClient> | null = null;

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

  try {
    admin = createAdminClient();
  } catch {
    admin = null;
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
  const claimed = Boolean(rewardRow.claimed);
  const availableAt = rewardRow.available_at ?? null;

  if (claimed && availableAt) {
    const availableMs = new Date(availableAt).getTime();
    const reminderMs = Number.isFinite(availableMs) ? availableMs - 2 * 60 * 60 * 1000 : Date.now();
    const reminderIso = new Date(reminderMs).toISOString();
    const dedupeDate = availableAt.slice(0, 10);

    const reminderEventResult = await supabase.rpc("enqueue_notification_event", {
      p_profile_id: user.id,
      p_event_type: "streak_reminder",
      p_payload: {
        source: "daily_reward",
        streak: Number(rewardRow.streak || 0),
        availableAt,
      },
      p_dedupe_key: `streak-reminder:${user.id}:${dedupeDate}`,
      p_channel: "telegram",
      p_scheduled_for: reminderIso,
    });

    if (reminderEventResult.error) {
      console.error("[DailyReward API] Failed to enqueue streak reminder", reminderEventResult.error.message);
    }
  }

  if (claimed) {
    const leaderboardStateResult = await supabase.rpc("sync_leaderboard_presence_event", {
      p_profile_id: user.id,
    });

    if (leaderboardStateResult.error) {
      console.error("[DailyReward API] Failed to sync leaderboard presence", leaderboardStateResult.error.message);
    }

    if (admin) {
      const weeklyTitlesRefreshResult = await admin.rpc("refresh_weekly_titles");
      if (weeklyTitlesRefreshResult.error) {
        console.error("[DailyReward API] Failed to refresh weekly titles", weeklyTitlesRefreshResult.error.message);
      }
    }
  }

  return NextResponse.json({
    success: true,
    claimed,
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
