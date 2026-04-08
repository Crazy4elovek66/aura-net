import {
  ANONYMOUS_VOTE_COST,
  ANONYMOUS_VOTE_DAILY_LIMIT,
  VOTE_DAILY_LIMIT,
} from "@/lib/economy";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationStates, isProfileLimited } from "@/lib/server/profile-moderation";
import { consumePersistentRateLimit, consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
  buildRateLimitResponse,
} from "@/lib/server/route-response";
import { invalidateRuntimeCache } from "@/lib/server/runtime-cache";
import { drainRuntimeReliabilityWork, scheduleInternalRuntimeDrain } from "@/lib/server/runtime-reliability";
import { enqueueRuntimeJob } from "@/lib/server/runtime-jobs";
import {
  buildVoteSuccessPayload as buildVoteSuccessPayloadForResponse,
} from "@/lib/server/vote-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";

const AI_COMMENTS = {
  up: [
    "Этот вайб не купить. Плюс аура заслужен.",
    "Сильный ход. Плюс уважение в копилку.",
    "Стиль считывается сразу. Хороший плюс.",
    "Это было мощно. Аура пошла вверх.",
  ],
  down: [
    "Сегодня вайб не дотянул.",
    "Минус аура. Пора перезарядиться.",
    "Этот заход не сработал.",
    "Кринж-чек не пройден. Нужно возвращение.",
  ],
} as const;

interface CastVoteRow {
  vote_id?: string | null;
  aura_change?: number | null;
  regular_votes_used?: number | null;
  anonymous_votes_used?: number | null;
  voter_aura_left?: number | null;
  target_aura?: number | null;
}

async function runVoteSideEffects(params: {
  targetId: string;
  voterId: string;
  voteId: string;
  type: "up" | "down";
  isAnonymous: boolean;
  auraChange: number;
}) {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("[Vote API] Failed to initialize admin client for side effects", error);
    await createOpsEvent({
      level: "error",
      scope: "vote",
      eventType: "side_effect_admin_client_failed",
      profileId: params.targetId,
      actorId: params.voterId,
      message: "Failed to initialize admin client for vote side effects",
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return;
  }

  const { targetId, voterId, voteId, type, isAnonymous, auraChange } = params;
  const notificationBucket = new Date().toISOString().slice(0, 13);
  const { data: voterProfile } = await admin
    .from("profiles")
    .select("username, display_name")
    .eq("id", voterId)
    .maybeSingle();
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
    dedupeKey: string;
    payload: Record<string, unknown>;
    profileId?: string;
    actorId?: string;
  }) {
    queuedFollowUp = true;
    await createOpsEvent({
      level: "warn",
      scope: "vote",
      eventType: params.eventType,
      profileId: params.profileId || targetId,
      actorId: params.actorId || voterId,
      message: params.message,
      payload: params.payload,
    });
    await enqueueRuntimeJob({
      jobType: params.jobType,
      dedupeKey: params.dedupeKey,
      payload: params.payload,
    });
  }

  const notificationPayload = {
    voteId,
    voteType: type,
    auraChange,
    voterId,
    voterUsername: voterProfile?.username || null,
    voterDisplayName: voterProfile?.display_name || voterProfile?.username || null,
    anonymous: isAnonymous,
    createdAt: new Date().toISOString(),
  };

  const notificationResult = await admin.rpc("enqueue_notification_event", {
    p_profile_id: targetId,
    p_event_type: "new_vote",
    p_payload: notificationPayload,
    p_dedupe_key: `new-vote:${targetId}:${notificationBucket}`,
    p_channel: "telegram",
  });

  if (notificationResult.error) {
    console.error("[Vote API] Failed to enqueue vote notification", notificationResult.error.message);
    await queueJob({
      eventType: "vote_notification_enqueue_failed",
      message: notificationResult.error.message,
      jobType: "enqueue_notification_event",
      dedupeKey: `vote:notification:${targetId}:${notificationBucket}`,
      payload: {
        profileId: targetId,
        eventType: "new_vote",
        data: notificationPayload,
        dedupeKey: `new-vote:${targetId}:${notificationBucket}`,
        channel: "telegram",
      },
    });
  }

  const leaderboardResult = await admin.rpc("sync_leaderboard_presence_event", {
    p_profile_id: targetId,
  });
  if (leaderboardResult.error) {
    console.error("[Vote API] Failed to sync leaderboard presence", leaderboardResult.error.message);
    await queueJob({
      eventType: "vote_leaderboard_sync_failed",
      message: leaderboardResult.error.message,
      jobType: "sync_leaderboard_presence",
      dedupeKey: `vote:leaderboard:${targetId}`,
      payload: {
        profileId: targetId,
      },
    });
  }

  const refreshWeeklyTitlesResult = await admin.rpc("refresh_weekly_titles");
  if (refreshWeeklyTitlesResult.error) {
    console.error("[Vote API] Failed to refresh weekly titles", refreshWeeklyTitlesResult.error.message);
    await queueJob({
      eventType: "vote_weekly_titles_refresh_failed",
      message: refreshWeeklyTitlesResult.error.message,
      jobType: "refresh_weekly_titles",
      dedupeKey: `vote:weekly-refresh:${new Date().toISOString().slice(0, 13)}`,
      payload: {
        source: "vote",
        voteId,
      },
    });
  }

  const voterReferralResult = await admin.rpc("activate_referral_if_eligible", {
    p_invitee_id: voterId,
    p_source: "vote_cast",
    p_context: { source: "vote", voteId },
  });
  if (voterReferralResult.error) {
    console.error("[Vote API] Failed to activate voter referral", voterReferralResult.error.message);
    await queueJob({
      eventType: "vote_referral_activation_failed",
      message: voterReferralResult.error.message,
      jobType: "activate_referral",
      dedupeKey: `vote:referral:voter:${voterId}:${voteId}`,
      payload: {
        inviteeId: voterId,
        source: "vote_cast",
        context: { source: "vote", voteId },
      },
      profileId: voterId,
    });
  }

  const targetReferralResult = await admin.rpc("activate_referral_if_eligible", {
    p_invitee_id: targetId,
    p_source: "vote_received",
    p_context: { source: "vote", voteId },
  });
  if (targetReferralResult.error) {
    console.error("[Vote API] Failed to activate target referral", targetReferralResult.error.message);
    await queueJob({
      eventType: "vote_target_referral_activation_failed",
      message: targetReferralResult.error.message,
      jobType: "activate_referral",
      dedupeKey: `vote:referral:target:${targetId}:${voteId}`,
      payload: {
        inviteeId: targetId,
        source: "vote_received",
        context: { source: "vote", voteId },
      },
      profileId: targetId,
    });
  }

  if (type === "up") {
    const { count, error: upvotesCountError } = await admin
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", targetId)
      .eq("vote_type", "up");

    if (upvotesCountError) {
      console.error("[Vote API] Failed to count upvotes for achievement", upvotesCountError.message);
    } else if ((count || 0) >= 10) {
      const { error: achievementError } = await admin.rpc("grant_achievement", {
        p_profile_id: targetId,
        p_achievement_key: "upvotes_received_10",
        p_context: {
          source: "vote",
          upvotesCount: Number(count || 0),
          voteId,
        },
      });

      if (achievementError) {
        console.error("[Vote API] Failed to grant achievement", achievementError.message);
        await createOpsEvent({
          level: "warn",
          scope: "vote",
          eventType: "vote_achievement_grant_failed",
          profileId: targetId,
          actorId: voterId,
          message: achievementError.message,
          payload: {
            voteId,
            upvotesCount: Number(count || 0),
          },
        });
      }
    }
  }

  const weeklyMomentResult = await admin.rpc("emit_active_weekly_title_moments");
  if (weeklyMomentResult.error) {
    console.error("[Vote API] Failed to emit weekly title moments", weeklyMomentResult.error.message);
    await queueJob({
      eventType: "vote_weekly_moments_failed",
      message: weeklyMomentResult.error.message,
      jobType: "emit_weekly_title_moments",
      dedupeKey: `vote:weekly-moments:${targetId}:${new Date().toISOString().slice(0, 10)}`,
      payload: {
        profileId: targetId,
        source: "vote",
        voteId,
      },
    });
  }

  await drainRuntimeReliabilityWork({
    source: "vote-after",
  });

  if (queuedFollowUp) {
    await scheduleInternalRuntimeDrain("vote-follow-up");
  }
}

function mapVoteRpcError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already voted")) {
    return {
      status: 400,
      code: "ALREADY_VOTED",
      error: "Ты уже голосовал за этот профиль.",
    };
  }

  if (normalized.includes("self vote forbidden")) {
    return {
      status: 400,
      code: "SELF_VOTE_FORBIDDEN",
      error: "Голосовать за себя нельзя.",
    };
  }

  if (normalized.includes("anonymous vote daily limit reached")) {
    return {
      status: 429,
      code: "ANONYMOUS_DAILY_LIMIT_REACHED",
      error: `Лимит анонимных голосов на сегодня исчерпан (${ANONYMOUS_VOTE_DAILY_LIMIT}/${ANONYMOUS_VOTE_DAILY_LIMIT}).`,
    };
  }

  if (normalized.includes("regular vote daily limit reached")) {
    return {
      status: 429,
      code: "VOTE_DAILY_LIMIT_REACHED",
      error: `Лимит обычных голосов на сегодня исчерпан (${VOTE_DAILY_LIMIT}/${VOTE_DAILY_LIMIT}).`,
    };
  }

  if (normalized.includes("insufficient aura")) {
    return {
      status: 403,
      code: "INSUFFICIENT_AURA",
      error: `Недостаточно ауры для анонимного голоса. Нужно ${ANONYMOUS_VOTE_COST}.`,
    };
  }

  if (normalized.includes("invalid vote type")) {
    return {
      status: 400,
      code: "INVALID_VOTE_PAYLOAD",
      error: "Некорректные данные голоса.",
    };
  }

  if (normalized.includes("not allowed")) {
    return {
      status: 403,
      code: "FORBIDDEN",
      error: API_ERROR_MESSAGES.forbidden,
    };
  }

  if (normalized.includes("profile not found")) {
    return {
      status: 404,
      code: "PROFILE_NOT_FOUND",
      error: "Профиль не найден.",
    };
  }

  if (normalized.includes("function") && normalized.includes("does not exist")) {
    return {
      status: 501,
      code: "FUNCTION_MISSING",
      error: "Функция голосования не найдена. Примени актуальные миграции.",
    };
  }

  return {
    status: 500,
    code: "VOTE_CREATE_FAILED",
    error: "Не удалось создать голос.",
  };
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `vote:ip:${getRequestIp(request)}`,
    limit: 12,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток голосования. Подожди несколько секунд.", burstLimit);
  }

  const supabase = await createClient();
  let payload: { targetId?: unknown; type?: unknown; isAnonymous?: unknown };

  try {
    payload = await request.json();
  } catch {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidJson, {
      code: "INVALID_JSON",
    });
  }

  const targetId = typeof payload.targetId === "string" ? payload.targetId.trim() : "";
  const type = payload.type === "up" || payload.type === "down" ? payload.type : null;
  const isAnonymous = Boolean(payload.isAnonymous);

  if (!targetId || !type) {
    return buildApiErrorResponse(400, "Некорректные данные голоса.", {
      code: "INVALID_VOTE_PAYLOAD",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildApiErrorResponse(401, "Нужно войти, чтобы голосовать.", {
      code: "UNAUTHORIZED",
    });
  }

  const moderationMap = await getProfileModerationStates([user.id, targetId]);
  const voterModeration = moderationMap.get(user.id);
  const targetModeration = moderationMap.get(targetId);

  if (isProfileLimited(voterModeration)) {
    await createOpsEvent({
      level: "warn",
      scope: "vote",
      eventType: "limited_profile_vote_blocked",
      profileId: user.id,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: "Vote blocked because actor profile is limited",
      payload: {
        targetId,
      },
    });

    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileLimited, {
      code: "PROFILE_LIMITED",
    });
  }

  if (isProfileLimited(targetModeration)) {
    return buildApiErrorResponse(403, API_ERROR_MESSAGES.profileUnavailableForVoting, {
      code: "TARGET_PROFILE_LIMITED",
    });
  }

  const userLimit = await consumePersistentRateLimit({
    key: `vote:user:${user.id}`,
    limit: 6,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток голосования. Подожди несколько секунд.", userLimit);
  }

  const { data, error } = await supabase
    .rpc("cast_profile_vote", {
      p_voter_id: user.id,
      p_target_id: targetId,
      p_vote_type: type,
      p_is_anonymous: isAnonymous,
      p_anonymous_cost: ANONYMOUS_VOTE_COST,
      p_regular_daily_limit: VOTE_DAILY_LIMIT,
      p_anonymous_daily_limit: ANONYMOUS_VOTE_DAILY_LIMIT,
    })
    .single();

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "vote",
      eventType: "vote_cast_failed",
      profileId: targetId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message,
      payload: {
        code: error.code,
        details: error.details,
        hint: error.hint,
        anonymous: isAnonymous,
      },
    });

    const mapped = mapVoteRpcError(error.message || "");
    return buildApiErrorResponse(mapped.status, mapped.error, {
      code: mapped.code,
    });
  }

  const row = (data || {}) as CastVoteRow;
  const voteId = row.vote_id || "";
  const auraChange = Number(row.aura_change || 0);

  invalidateRuntimeCache([
    "discover:v2",
    "leaderboard-full:v2",
    "leaderboard-preview:v2",
    "landing-stats:v2",
  ]);

  if (voteId) {
    after(async () => {
      await runVoteSideEffects({
        targetId,
        voterId: user.id,
        voteId,
        type,
        isAnonymous,
        auraChange,
      });
    });
  }

  return buildApiSuccessResponse(buildVoteSuccessPayloadForResponse(type, row, AI_COMMENTS));
}
