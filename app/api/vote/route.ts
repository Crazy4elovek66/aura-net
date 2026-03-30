import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const AI_COMMENTS = {
  up: [
    "Этот вайб нельзя купить. Ты просто Сигма, бро! 🔥",
    "Аура зашкаливает. Главный герой в здании. ✨",
    "Фр фр, это было мощно. +Респект в копилку.",
    "Чистый люкс. Твой стиль — это искусство. 🤝",
  ],
  down: [
    "Ой... Кажется, кто-то словил кринж. 💀",
    "Минус аура. Попробуй сменить имидж, НПС.",
    "Вайб-чек провален. Сегодня не твой день, бести.",
    "Энергетика на нуле. Срочно нужно подзарядиться. 🔋",
  ],
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { targetId, type, isAnonymous } = await request.json();

  // 1. Проверка авторизации
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Нужно войти, чтобы влиять на ауру" }, { status: 401 });
  }

  // 2. Нельзя голосовать за себя
  if (user.id === targetId) {
    return NextResponse.json({ error: "Самолайк — залог НПС. Не делай так." }, { status: 400 });
  }

  // 3. Обработка налога на анонимность (-50 очков)
  if (isAnonymous) {
    const { data: voterProfile } = await supabase.from("profiles").select("aura_points").eq("id", user.id).single();
    if ((voterProfile?.aura_points || 0) < 50) {
      return NextResponse.json({ error: "Недостаточно ауры для анонимного голоса (нужно 50)" }, { status: 403 });
    }

    // Списываем налог
    await supabase.rpc("increment_aura", { target_id: user.id, amount: -50 });
    // Логируем транзакцию
    await supabase.from("transactions").insert({
      user_id: user.id,
      amount: -50,
      type: 'tax',
      description: 'Налог на анонимное голосование'
    });
  }

  // 4. Записываем голос
  const { error: voteError } = await supabase
    .from("votes")
    .insert({
      voter_id: user.id,
      target_id: targetId,
      vote_type: type,
      is_anonymous: !!isAnonymous
    });

  if (voteError) {
    if (voteError.code === "23505") {
      return NextResponse.json({ error: "Ты уже раздал базы этому профилю 🫡" }, { status: 400 });
    }
    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  // 5. Обновляем очки ауры цели (+10/-10)
  const auraChange = type === "up" ? 10 : -10;
  await supabase.rpc("increment_aura", { target_id: targetId, amount: auraChange });

  // 6. Генерируем саркастичный комментарий (автономно)
  const comments = type === "up" ? AI_COMMENTS.up : AI_COMMENTS.down;
  const aiComment = comments[Math.floor(Math.random() * comments.length)];

  return NextResponse.json({
    success: true,
    comment: aiComment,
    newAuraChange: auraChange,
  });
}
