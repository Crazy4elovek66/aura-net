import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const DAILY_DECAY_PERCENT = 3;

export async function GET() {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const [profilesResult, votesResult, transactionsResult] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("votes").select("id", { count: "exact", head: true }),
    admin.from("transactions").select("id", { count: "exact", head: true }),
  ]);

  if (profilesResult.error || votesResult.error || transactionsResult.error) {
    console.error("[LandingStats API] Failed to load stats", {
      profilesError: profilesResult.error?.message,
      votesError: votesResult.error?.message,
      transactionsError: transactionsResult.error?.message,
    });

    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
  }

  return NextResponse.json({
    profilesCount: Number(profilesResult.count || 0),
    votesCount: Number(votesResult.count || 0),
    transactionsCount: Number(transactionsResult.count || 0),
    dailyDecayPercent: DAILY_DECAY_PERCENT,
  });
}
