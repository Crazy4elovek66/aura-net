import { buildCacheControl, getOrSetRuntimeCache } from "@/lib/server/runtime-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const DAILY_DECAY_PERCENT = 3;
const LANDING_STATS_CACHE_TTL_MS = 60_000;

async function loadLandingStats() {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    throw new Error("SERVER_CONFIG");
  }

  const [profilesResult, votesResult, transactionsResult] = await Promise.all([
    admin.from("profiles").select("id", { count: "planned", head: true }),
    admin.from("votes").select("id", { count: "planned", head: true }),
    admin.from("transactions").select("id", { count: "planned", head: true }),
  ]);

  if (profilesResult.error || votesResult.error || transactionsResult.error) {
    console.error("[LandingStats API] Failed to load stats", {
      profilesError: profilesResult.error?.message,
      votesError: votesResult.error?.message,
      transactionsError: transactionsResult.error?.message,
    });

    throw new Error("LOAD_LANDING_STATS_FAILED");
  }

  return {
    profilesCount: Number(profilesResult.count || 0),
    votesCount: Number(votesResult.count || 0),
    transactionsCount: Number(transactionsResult.count || 0),
    dailyDecayPercent: DAILY_DECAY_PERCENT,
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const payload = await getOrSetRuntimeCache("landing-stats:v2", LANDING_STATS_CACHE_TTL_MS, loadLandingStats);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": buildCacheControl(LANDING_STATS_CACHE_TTL_MS, LANDING_STATS_CACHE_TTL_MS * 2),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SERVER_CONFIG") {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
  }
}
