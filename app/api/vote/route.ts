import {
  ANONYMOUS_VOTE_COST,
  ANONYMOUS_VOTE_DAILY_LIMIT,
  VOTE_DAILY_LIMIT,
  getUtcDayWindow,
} from "@/lib/economy";
import { drainPendingNotificationQueue } from "@/lib/server/notification-delivery";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationStates, isProfileLimited } from "@/lib/server/profile-moderation";
import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import { buildRateLimitResponse } from "@/lib/server/route-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { NextResponse } from "next/server";

const AI_COMMENTS = {
  up: [
    "Этот вайб нельзя купить. Ты просто сигма, бро.",
    "Аура зашкаливает. Главный герой в здании.",
    "Это было мощно. Плюс респект в копилку.",
    "Чистый люкс. Твой стиль это искусство.",
  ],
  down: [
    "Ой... Похоже кто-то словил кринж.",
    "Минус аура. Попробуй сменить имидж, НПС.",
    "Вайб-чек провален. Сегодня не твой день.",
    "Энергетика на нуле. Срочно нужна перезарядка.",
  ],
};

async function rollbackAnonymousCharge(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  taxTransactionId: string | null,
) {
  await admin.rpc("increment_aura", { target_id: userId, amount: ANONYMOUS_VOTE_COST });

  if (taxTransactionId) {
    await admin.from("transactions").delete().eq("id", taxTransactionId);
  }
}

async function rollbackVoteMutation(params: {
  admin: ReturnType<typeof createAdminClient>;
  voteId: string;
  targetId: string;
  auraChange: number;
  isAnonymous: boolean;
  voterId: string;
  taxTransactionId: string | null;
}) {
  const { admin, voteId, targetId, auraChange, isAnonymous, voterId, taxTransactionId } = params;
  const rollbackResults = await Promise.allSettled([
    admin.from("votes").delete().eq("id", voteId),
    admin.rpc("increment_aura", {
      target_id: targetId,
      amount: -auraChange,
    }),
    isAnonymous ? rollbackAnonymousCharge(admin, voterId, taxTransactionId) : Promise.resolve(),
  ]);

  const failedRollback = rollbackResults.find((result) => result.status === "rejected");
  if (failedRollback?.status === "rejected") {
    await createOpsEvent({
      level: "critical",
      scope: "vote",
      eventType: "vote_rollback_failed",
      profileId: targetId,
      actorId: voterId,
      message: failedRollback.reason instanceof Error ? failedRollback.reason.message : String(failedRollback.reason),
      payload: {
        voteId,
        auraChange,
        anonymous: isAnonymous,
      },
    });
  }
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

  const sideEffects: Array<PromiseLike<unknown> | unknown> = [
    admin.rpc("enqueue_notification_event", {
      p_profile_id: targetId,
      p_event_type: "new_vote",
      p_payload: {
        voteId,
        voteType: type,
        auraChange,
        voterId,
        voterUsername: voterProfile?.username || null,
        voterDisplayName: voterProfile?.display_name || voterProfile?.username || null,
        anonymous: isAnonymous,
        createdAt: new Date().toISOString(),
      },
      p_dedupe_key: `new-vote:${targetId}:${notificationBucket}`,
      p_channel: "telegram",
    }),
    admin.rpc("sync_leaderboard_presence_event", {
      p_profile_id: targetId,
    }),
    admin.rpc("refresh_weekly_titles"),
    admin.rpc("activate_referral_if_eligible", {
      p_invitee_id: voterId,
      p_source: "vote_cast",
      p_context: { source: "vote", voteId },
    }),
    admin.rpc("activate_referral_if_eligible", {
      p_invitee_id: targetId,
      p_source: "vote_received",
      p_context: { source: "vote", voteId },
    }),
  ];

  if (type === "up") {
    sideEffects.push(
      (async () => {
        const { count, error: upvotesCountError } = await admin
          .from("votes")
          .select("id", { count: "exact", head: true })
          .eq("target_id", targetId)
          .eq("vote_type", "up");

        if (upvotesCountError) {
          console.error("[Vote API] Failed to count upvotes for achievement", upvotesCountError.message);
          return;
        }

        if ((count || 0) < 10) {
          return;
        }

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
        }
      })(),
    );
  }

  const results = await Promise.allSettled(sideEffects);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[Vote API] Side effect failed", result.reason);
      continue;
    }

    const value = result.value as { error?: { message?: string } } | undefined;
    if (value?.error?.message) {
      console.error("[Vote API] Side effect failed", value.error.message);
    }
  }

  const weeklyMomentResult = await admin.rpc("emit_active_weekly_title_moments");
  if (weeklyMomentResult.error) {
    console.error("[Vote API] Failed to emit weekly title moments", weeklyMomentResult.error.message);
  }

  await drainPendingNotificationQueue();
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
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  let payload: { targetId?: unknown; type?: unknown; isAnonymous?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const targetId = typeof payload.targetId === "string" ? payload.targetId : "";
  const type = payload.type === "up" || payload.type === "down" ? payload.type : null;
  const isAnonymous = Boolean(payload.isAnonymous);

  if (!targetId || !type) {
    return NextResponse.json({ error: "Некорректные данные голоса" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Нужно войти, чтобы голосовать" }, { status: 401 });
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

    return NextResponse.json({ error: "РџСЂРѕС„РёР»СЊ РІСЂРµРјРµРЅРЅРѕ РѕРіСЂР°РЅРёС‡РµРЅ" }, { status: 403 });
  }

  if (isProfileLimited(targetModeration)) {
    return NextResponse.json({ error: "РџСЂРѕС„РёР»СЊ РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ РґР»СЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ" }, { status: 403 });
  }

  const userLimit = consumeRateLimit({
    key: `vote:user:${user.id}`,
    limit: 6,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Слишком много попыток голосования. Подожди несколько секунд.", userLimit);
  }

  if (user.id === targetId) {
    return NextResponse.json({ error: "Голосовать за себя нельзя" }, { status: 400 });
  }

  const { start, end } = getUtcDayWindow();
  const dayStartIso = start.toISOString();
  const dayEndIso = end.toISOString();

  const [existingVoteResult, regularVotesResult, anonymousVotesResult] = await Promise.all([
    supabase.from("votes").select("id").eq("voter_id", user.id).eq("target_id", targetId).maybeSingle(),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("voter_id", user.id)
      .eq("is_anonymous", false)
      .gte("created_at", dayStartIso)
      .lt("created_at", dayEndIso),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("voter_id", user.id)
      .eq("is_anonymous", true)
      .gte("created_at", dayStartIso)
      .lt("created_at", dayEndIso),
  ]);

  if (existingVoteResult.error) {
    await createOpsEvent({
      level: "error",
      scope: "vote",
      eventType: "existing_vote_lookup_failed",
      profileId: targetId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: existingVoteResult.error.message,
    });
    return NextResponse.json({ error: "Не удалось проверить предыдущий голос" }, { status: 500 });
  }

  if (existingVoteResult.data) {
    return NextResponse.json({ error: "Ты уже голосовал за этот профиль" }, { status: 400 });
  }

  if (regularVotesResult.error || anonymousVotesResult.error) {
    await createOpsEvent({
      level: "error",
      scope: "vote",
      eventType: "daily_limit_lookup_failed",
      profileId: targetId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: regularVotesResult.error?.message || anonymousVotesResult.error?.message || "Failed to check vote limits",
    });
    return NextResponse.json({ error: "Не удалось проверить дневные лимиты" }, { status: 500 });
  }

  const regularVotesToday = Number(regularVotesResult.count || 0);
  const anonymousVotesToday = Number(anonymousVotesResult.count || 0);

  if (isAnonymous && anonymousVotesToday >= ANONYMOUS_VOTE_DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `Лимит анонимных голосов на сегодня исчерпан (${ANONYMOUS_VOTE_DAILY_LIMIT}/${ANONYMOUS_VOTE_DAILY_LIMIT})`,
      },
      { status: 429 },
    );
  }

  if (!isAnonymous && regularVotesToday >= VOTE_DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `Лимит обычных голосов на сегодня исчерпан (${VOTE_DAILY_LIMIT}/${VOTE_DAILY_LIMIT})`,
      },
      { status: 429 },
    );
  }

  let taxTransactionId: string | null = null;

  if (isAnonymous) {
    const { data: voterProfile, error: voterProfileError } = await supabase
      .from("profiles")
      .select("aura_points")
      .eq("id", user.id)
      .maybeSingle();

    if (voterProfileError) {
      return NextResponse.json({ error: "Не удалось проверить баланс" }, { status: 500 });
    }

    if (!voterProfile) {
      return NextResponse.json(
        { error: "Для анонимного голоса нужен полноценный профиль с аурой" },
        { status: 403 },
      );
    }

    if ((voterProfile.aura_points || 0) < ANONYMOUS_VOTE_COST) {
      return NextResponse.json(
        { error: `Недостаточно ауры для анонимного голоса (нужно ${ANONYMOUS_VOTE_COST})` },
        { status: 403 },
      );
    }

    const { error: taxError } = await supabase.rpc("increment_aura", {
      target_id: user.id,
      amount: -ANONYMOUS_VOTE_COST,
    });

    if (taxError) {
      const notEnoughAura = taxError.message.toLowerCase().includes("insufficient aura");
      return NextResponse.json(
        { error: notEnoughAura ? "Недостаточно ауры для анонимного голоса" : "Не удалось списать стоимость анонимности" },
        { status: notEnoughAura ? 403 : 500 },
      );
    }

    const { data: taxTransaction, error: taxTransactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount: -ANONYMOUS_VOTE_COST,
        type: "tax",
        description: "Налог за анонимное голосование",
        metadata: { source: "vote", anonymous: true },
      })
      .select("id")
      .single();

    if (taxTransactionError) {
      await rollbackAnonymousCharge(admin, user.id, null);
      return NextResponse.json({ error: "Не удалось зафиксировать налог в истории" }, { status: 500 });
    }

    taxTransactionId = taxTransaction.id;
  }

  const { data: createdVote, error: voteError } = await supabase
    .from("votes")
    .insert({
      voter_id: user.id,
      target_id: targetId,
      vote_type: type,
      is_anonymous: isAnonymous,
    })
    .select("id")
    .single();

  if (voteError) {
    await createOpsEvent({
      level: "error",
      scope: "vote",
      eventType: "vote_insert_failed",
      profileId: targetId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: voteError.message,
      payload: {
        code: voteError.code,
        anonymous: isAnonymous,
      },
    });
    if (isAnonymous) {
      await rollbackAnonymousCharge(admin, user.id, taxTransactionId);
    }

    if (voteError.code === "23505") {
      return NextResponse.json({ error: "Ты уже голосовал за этот профиль" }, { status: 400 });
    }

    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  if (!createdVote) {
    if (isAnonymous) {
      await rollbackAnonymousCharge(admin, user.id, taxTransactionId);
    }

    return NextResponse.json({ error: "Не удалось создать голос" }, { status: 500 });
  }

  const auraChange = type === "up" ? 10 : -10;
  const { data: targetProfileBefore, error: targetProfileBeforeError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .single();

  if (targetProfileBeforeError || !targetProfileBefore) {
    await admin.from("votes").delete().eq("id", createdVote.id);

    if (isAnonymous) {
      await rollbackAnonymousCharge(admin, user.id, taxTransactionId);
    }

    return NextResponse.json({ error: "Не удалось прочитать баланс цели" }, { status: 500 });
  }

  const { error: auraUpdateError } = await admin.rpc("increment_aura", {
    target_id: targetId,
    amount: auraChange,
  });

  if (auraUpdateError) {
    await createOpsEvent({
      level: "error",
      scope: "vote",
      eventType: "target_aura_update_failed",
      profileId: targetId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: auraUpdateError.message,
      payload: {
        voteId: createdVote.id,
        auraChange,
      },
    });
    await admin.from("votes").delete().eq("id", createdVote.id);

    if (isAnonymous) {
      await rollbackAnonymousCharge(admin, user.id, taxTransactionId);
    }

    return NextResponse.json({ error: "Не удалось обновить ауру цели" }, { status: 500 });
  }

  const transactionType: "vote_up" | "vote_down" = type === "up" ? "vote_up" : "vote_down";
  const { error: transactionError } = await admin.from("transactions").insert({
    user_id: targetId,
    amount: auraChange,
    type: transactionType,
    description: type === "up" ? "Получен плюс-аура голос" : "Получен минус-аура голос",
    metadata: {
      source: "vote",
      voteId: createdVote.id,
      voterId: user.id,
      anonymous: isAnonymous,
    },
  });

  if (transactionError) {
    console.error("[Vote API] Failed to write target transaction", transactionError.message);
    await createOpsEvent({
      level: "error",
      scope: "vote",
      eventType: "vote_transaction_write_failed",
      profileId: targetId,
      actorId: user.id,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: transactionError.message,
      payload: {
        voteId: createdVote.id,
      },
    });
    await rollbackVoteMutation({
      admin,
      voteId: createdVote.id,
      targetId,
      auraChange,
      isAnonymous,
      voterId: user.id,
      taxTransactionId,
    });

    return NextResponse.json({ error: "Не удалось зафиксировать изменение ауры" }, { status: 500 });
  }

  after(async () => {
    await runVoteSideEffects({
      targetId,
      voterId: user.id,
      voteId: createdVote.id,
      type,
      isAnonymous,
      auraChange,
    });
  });

  const comments = type === "up" ? AI_COMMENTS.up : AI_COMMENTS.down;
  const aiComment = comments[Math.floor(Math.random() * comments.length)];

  return NextResponse.json({
    success: true,
    comment: aiComment,
    newAuraChange: auraChange,
    limits: {
      regularUsed: regularVotesToday + Number(!isAnonymous),
      regularLimit: VOTE_DAILY_LIMIT,
      anonymousUsed: anonymousVotesToday + Number(isAnonymous),
      anonymousLimit: ANONYMOUS_VOTE_DAILY_LIMIT,
    },
  });
}
