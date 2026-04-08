import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import { drainPendingNotificationQueue } from "@/lib/server/notification-delivery";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationState, isProfileLimited } from "@/lib/server/profile-moderation";
import { buildRateLimitResponse } from "@/lib/server/route-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
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

async function runDailyRewardSideEffects(userId: string, rewardRow: ClaimDailyRewardRow) {
  const availableAt = rewardRow.available_at ?? null;
  let admin: ReturnType<typeof createAdminClient> | null = null;

  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  if (!admin) {
    return;
  }

  if (availableAt) {
    const availableMs = new Date(availableAt).getTime();
    const reminderMs = Number.isFinite(availableMs) ? availableMs - 2 * 60 * 60 * 1000 : Date.now();
    const reminderIso = new Date(reminderMs).toISOString();
    const dedupeDate = availableAt.slice(0, 10);

    const reminderEventResult = await admin.rpc("enqueue_notification_event", {
      p_profile_id: userId,
      p_event_type: "streak_reminder",
      p_payload: {
        source: "daily_reward",
        streak: Number(rewardRow.streak || 0),
        availableAt,
      },
      p_dedupe_key: `streak-reminder:${userId}:${dedupeDate}`,
      p_channel: "telegram",
      p_scheduled_for: reminderIso,
    });

    if (reminderEventResult.error) {
      console.error("[DailyReward API] Failed to enqueue streak reminder", reminderEventResult.error.message);
    }
  }

  const leaderboardStateResult = await admin.rpc("sync_leaderboard_presence_event", {
    p_profile_id: userId,
  });

  if (leaderboardStateResult.error) {
    console.error("[DailyReward API] Failed to sync leaderboard presence", leaderboardStateResult.error.message);
  }

  const weeklyTitlesRefreshResult = await admin.rpc("refresh_weekly_titles");
  if (weeklyTitlesRefreshResult.error) {
    console.error("[DailyReward API] Failed to refresh weekly titles", weeklyTitlesRefreshResult.error.message);
  }

  const weeklyMomentsResult = await admin.rpc("emit_active_weekly_title_moments");
  if (weeklyMomentsResult.error) {
    console.error("[DailyReward API] Failed to emit weekly title moments", weeklyMomentsResult.error.message);
  }

  const referralResult = await admin.rpc("activate_referral_if_eligible", {
    p_invitee_id: userId,
    p_source: "daily_reward",
    p_context: {
      source: "daily_reward",
      streak: Number(rewardRow.streak || 0),
    },
  });

  if (referralResult.error) {
    console.error("[DailyReward API] Failed to activate referral", referralResult.error.message);
  }

  await drainPendingNotificationQueue();
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `daily-reward:ip:${getRequestIp(request)}`,
    limit: 6,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток получить награду. Подожди несколько секунд.", burstLimit);
  }

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

  const moderationState = await getProfileModerationState(user.id);
  if (isProfileLimited(moderationState)) {
    await createOpsEvent({
      level: "warn",
      scope: "daily_reward",
      eventType: "limited_profile_reward_blocked",
      profileId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: "Daily reward blocked because profile is limited",
    });

    return NextResponse.json({ error: "РџСЂРѕС„РёР»СЊ РІСЂРµРјРµРЅРЅРѕ РѕРіСЂР°РЅРёС‡РµРЅ" }, { status: 403 });
  }

  const userLimit = consumeRateLimit({
    key: `daily-reward:user:${user.id}`,
    limit: 3,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток получить награду. Подожди несколько секунд.", userLimit);
  }

  const { data, error } = await supabase.rpc("claim_daily_reward", { p_profile_id: user.id }).single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "daily_reward",
      eventType: "claim_daily_reward_failed",
      profileId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    });
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

  if (claimed) {
    after(async () => {
      await runDailyRewardSideEffects(user.id, rewardRow);
    });
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
