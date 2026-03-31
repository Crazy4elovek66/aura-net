import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .rpc("claim_daily_reward", { p_profile_id: user.id })
    .single();

  if (error) {
    const notFound = error.message.toLowerCase().includes("profile not found");
    return NextResponse.json(
      { error: notFound ? "Профиль не найден" : "Не удалось получить daily reward" },
      { status: notFound ? 404 : 500 },
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
