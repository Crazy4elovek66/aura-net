import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const AI_COMMENTS = {
  up: [
    "Этот вайб нельзя купить. Ты просто Сигма, бро.",
    "Аура зашкаливает. Главный герой в здании.",
    "Фр фр, это было мощно. +Респект в копилку.",
    "Чистый люкс. Твой стиль — это искусство.",
  ],
  down: [
    "Ой... Кажется, кто-то словил кринж.",
    "Минус аура. Попробуй сменить имидж, НПС.",
    "Вайб-чек провален. Сегодня не твой день, бести.",
    "Энергетика на нуле. Срочно нужно подзарядиться.",
  ],
};

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
    return NextResponse.json({ error: "Нужно войти, чтобы влиять на ауру" }, { status: 401 });
  }

  if (user.id === targetId) {
    return NextResponse.json({ error: "Самолайк — залог НПС. Не делай так." }, { status: 400 });
  }

  if (isAnonymous) {
    const { data: voterProfile, error: voterProfileError } = await supabase
      .from("profiles")
      .select("aura_points")
      .eq("id", user.id)
      .single();

    if (voterProfileError) {
      return NextResponse.json({ error: "Не удалось проверить баланс" }, { status: 500 });
    }

    if ((voterProfile?.aura_points || 0) < 50) {
      return NextResponse.json({ error: "Недостаточно ауры для анонимного голоса (нужно 50)" }, { status: 403 });
    }

    const { error: taxError } = await supabase.rpc("increment_aura", { target_id: user.id, amount: -50 });

    if (taxError) {
      return NextResponse.json({ error: "Не удалось списать налог за анонимность" }, { status: 500 });
    }

    const { error: taxTransactionError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: -50,
      type: "tax",
      description: "Налог за анонимное голосование",
      metadata: { source: "vote", anonymous: true },
    });

    if (taxTransactionError) {
      await admin.rpc("increment_aura", { target_id: user.id, amount: 50 });
      return NextResponse.json({ error: "Не удалось зафиксировать налог в истории" }, { status: 500 });
    }
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
    if (voteError.code === "23505") {
      return NextResponse.json({ error: "Ты уже раздал базы этому профилю" }, { status: 400 });
    }

    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  if (!createdVote) {
    return NextResponse.json({ error: "Не удалось создать голос" }, { status: 500 });
  }

  const auraChange = type === "up" ? 10 : -10;
  const { error: auraUpdateError } = await admin.rpc("increment_aura", {
    target_id: targetId,
    amount: auraChange,
  });

  if (auraUpdateError) {
    await supabase.from("votes").delete().eq("id", createdVote.id);

    if (isAnonymous) {
      await admin.rpc("increment_aura", { target_id: user.id, amount: 50 });
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

  const comments = type === "up" ? AI_COMMENTS.up : AI_COMMENTS.down;
  const aiComment = comments[Math.floor(Math.random() * comments.length)];

  return NextResponse.json({
    success: true,
    comment: aiComment,
    newAuraChange: auraChange,
  });
}

