import { consumePersistentRateLimit, consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationState, isProfileLimited } from "@/lib/server/profile-moderation";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { buildDailyRewardSuccessPayload } from "@/lib/server/daily-reward-flow";
import { invalidateRuntimeCache } from "@/lib/server/runtime-cache";
import { drainRuntimeReliabilityWork, scheduleInternalRuntimeDrain } from "@/lib/server/runtime-reliability";
import { enqueueRuntimeJob } from "@/lib/server/runtime-jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";

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

  let queuedFollowUp = false;

  async function queueJob(params: {
    eventType: string;
    message: string;
    jobType:
      | "enqueue_notification_event"
      | "sync_leaderboard_presence"
      | "refresh_weekly_titles"
      | "emit_weekly_title_moments"
      | "activate_referral";
    dedupeKey?: string;
    payload?: Record<string, unknown>;
  }) {
    queuedFollowUp = true;
    await createOpsEvent({
      level: "warn",
      scope: "daily_reward",
      eventType: params.eventType,
      profileId: userId,
      message: params.message,
      payload: params.payload,
    });
    await enqueueRuntimeJob({
      jobType: params.jobType,
      dedupeKey: params.dedupeKey || null,
      payload: params.payload,
    });
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
      await queueJob({
        eventType: "streak_reminder_enqueue_failed",
        message: reminderEventResult.error.message,
        jobType: "enqueue_notification_event",
        dedupeKey: `daily-reward:streak-reminder:${userId}:${dedupeDate}`,
        payload: {
          profileId: userId,
          eventType: "streak_reminder",
          data: {
            source: "daily_reward",
            streak: Number(rewardRow.streak || 0),
            availableAt,
          },
          dedupeKey: `streak-reminder:${userId}:${dedupeDate}`,
          channel: "telegram",
          scheduledFor: reminderIso,
        },
      });
    }
  }

  const leaderboardStateResult = await admin.rpc("sync_leaderboard_presence_event", {
    p_profile_id: userId,
  });

  if (leaderboardStateResult.error) {
    console.error("[DailyReward API] Failed to sync leaderboard presence", leaderboardStateResult.error.message);
    await queueJob({
      eventType: "leaderboard_presence_sync_failed",
      message: leaderboardStateResult.error.message,
      jobType: "sync_leaderboard_presence",
      dedupeKey: `daily-reward:leaderboard:${userId}`,
      payload: {
        profileId: userId,
      },
    });
  }

  const weeklyTitlesRefreshResult = await admin.rpc("refresh_weekly_titles");
  if (weeklyTitlesRefreshResult.error) {
    console.error("[DailyReward API] Failed to refresh weekly titles", weeklyTitlesRefreshResult.error.message);
    await queueJob({
      eventType: "weekly_titles_refresh_failed",
      message: weeklyTitlesRefreshResult.error.message,
      jobType: "refresh_weekly_titles",
      dedupeKey: `daily-reward:weekly-refresh:${userId}:${new Date().toISOString().slice(0, 13)}`,
      payload: {
        profileId: userId,
      },
    });
  }

  const weeklyMomentsResult = await admin.rpc("emit_active_weekly_title_moments");
  if (weeklyMomentsResult.error) {
    console.error("[DailyReward API] Failed to emit weekly title moments", weeklyMomentsResult.error.message);
    await queueJob({
      eventType: "weekly_title_moments_failed",
      message: weeklyMomentsResult.error.message,
      jobType: "emit_weekly_title_moments",
      dedupeKey: `daily-reward:weekly-moments:${userId}:${new Date().toISOString().slice(0, 10)}`,
      payload: {
        profileId: userId,
      },
    });
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
    await queueJob({
      eventType: "referral_activation_failed",
      message: referralResult.error.message,
      jobType: "activate_referral",
      dedupeKey: `daily-reward:referral:${userId}:${new Date().toISOString().slice(0, 10)}`,
      payload: {
        inviteeId: userId,
        source: "daily_reward",
        context: {
          source: "daily_reward",
          streak: Number(rewardRow.streak || 0),
        },
      },
    });
  }

  await drainRuntimeReliabilityWork({
    source: "daily-reward-after",
  });

  if (queuedFollowUp) {
    await scheduleInternalRuntimeDrain("daily-reward-follow-up");
  }
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
    return buildApiErrorResponse(401, "Не удалось проверить сессию.", {
      code: "SESSION_CHECK_FAILED",
    });
  }

  if (!user) {
    return buildApiErrorResponse(401, API_ERROR_MESSAGES.unauthorized, {
      code: "UNAUTHORIZED",
    });
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

    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  const userLimit = await consumePersistentRateLimit({
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

    return buildApiErrorResponse(
      notFound ? 404 : fnMissing ? 501 : permissionError ? 403 : 500,
      notFound
        ? "Профиль не найден."
        : fnMissing
          ? "Функция ежедневной награды не найдена в базе. Примени актуальные миграции."
          : permissionError
            ? "Недостаточно прав для получения ежедневной награды."
            : dbMessage || "Не удалось получить ежедневную награду.",
      {
        code: notFound
          ? "PROFILE_NOT_FOUND"
          : fnMissing
            ? "FUNCTION_MISSING"
            : permissionError
              ? "FORBIDDEN"
              : "DAILY_REWARD_FAILED",
      },
    );
  }

  const rewardRow = (data || {}) as ClaimDailyRewardRow;
  const claimed = Boolean(rewardRow.claimed);

  invalidateRuntimeCache([
    "discover:v2",
    "leaderboard-full:v2",
    "leaderboard-preview:v2",
    "landing-stats:v2",
  ]);

  if (claimed) {
    after(async () => {
      await runDailyRewardSideEffects(user.id, rewardRow);
    });
  }

  return buildApiSuccessResponse(buildDailyRewardSuccessPayload(rewardRow));
}
