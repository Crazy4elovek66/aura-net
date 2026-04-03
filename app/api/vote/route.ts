import {
  ANONYMOUS_VOTE_COST,
  ANONYMOUS_VOTE_DAILY_LIMIT,
  VOTE_DAILY_LIMIT,
  getUtcDayWindow,
} from "@/lib/economy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

export async function POST(request: Request) {
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

  if (user.id === targetId) {
    return NextResponse.json({ error: "Голосовать за себя нельзя" }, { status: 400 });
  }

  const { data: existingVote, error: existingVoteError } = await supabase
    .from("votes")
    .select("id")
    .eq("voter_id", user.id)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existingVoteError) {
    return NextResponse.json({ error: "Не удалось проверить предыдущий голос" }, { status: 500 });
  }

  if (existingVote) {
    return NextResponse.json({ error: "Ты уже голосовал за этот профиль" }, { status: 400 });
  }

  const { start, end } = getUtcDayWindow();
  const dayStartIso = start.toISOString();
  const dayEndIso = end.toISOString();

  const { data: todayVotes, error: todayVotesError } = await supabase
    .from("votes")
    .select("is_anonymous")
    .eq("voter_id", user.id)
    .gte("created_at", dayStartIso)
    .lt("created_at", dayEndIso);

  if (todayVotesError) {
    return NextResponse.json({ error: "Не удалось проверить дневные лимиты" }, { status: 500 });
  }

  let regularVotesToday = 0;
  let anonymousVotesToday = 0;

  for (const vote of todayVotes || []) {
    if (vote.is_anonymous) {
      anonymousVotesToday += 1;
    } else {
      regularVotesToday += 1;
    }
  }

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
  const { error: auraUpdateError } = await admin.rpc("increment_aura", {
    target_id: targetId,
    amount: auraChange,
  });

  if (auraUpdateError) {
    await admin.from("votes").delete().eq("id", createdVote.id);

    if (isAnonymous) {
      await rollbackAnonymousCharge(admin, user.id, taxTransactionId);
    }

    return NextResponse.json({ error: "Не удалось обновить ауру цели" }, { status: 500 });
  }

  const transactionType: "vote_up" | "vote_down" = type === "up" ? "vote_up" : "vote_down";

  const { error: targetTransactionError } = await admin.from("transactions").insert({
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

  if (targetTransactionError) {
    console.error("[Vote API] Failed to write target transaction", targetTransactionError.message);
  }

  if (type === "up") {
    const { count: upvotesCount, error: upvotesCountError } = await admin
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", targetId)
      .eq("vote_type", "up");

    if (upvotesCountError) {
      console.error("[Vote API] Failed to count upvotes for achievement", upvotesCountError.message);
    } else if ((upvotesCount || 0) >= 10) {
      const { error: achievementError } = await admin.rpc("grant_achievement", {
        p_profile_id: targetId,
        p_achievement_key: "upvotes_received_10",
        p_context: {
          source: "vote",
          upvotesCount: Number(upvotesCount || 0),
          voteId: createdVote.id,
        },
      });

      if (achievementError) {
        console.error("[Vote API] Failed to grant achievement", achievementError.message);
      }
    }
  }

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
