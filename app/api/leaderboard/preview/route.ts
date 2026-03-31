import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface GrowthLeaderRow {
  user_id: string;
  username: string;
  display_name: string;
  aura_points: number;
  growth_points: number;
}

export async function GET() {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const [auraResult, growthResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, aura_points")
      .order("aura_points", { ascending: false })
      .limit(5),
    admin.rpc("get_growth_leaderboard", { p_days: 7, p_limit: 5 }),
  ]);

  if (auraResult.error || growthResult.error) {
    console.error("[Leaderboard API] Failed to load preview", {
      auraError: auraResult.error?.message,
      growthError: growthResult.error?.message,
    });

    return NextResponse.json({ error: "Не удалось загрузить лидерборд" }, { status: 500 });
  }

  const auraLeaders = (auraResult.data || []).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: Number(row.aura_points || 0),
  }));

  const growthLeaders = ((growthResult.data as GrowthLeaderRow[] | null) || []).map((row) => ({
    id: row.user_id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: Number(row.aura_points || 0),
    growthPoints: Number(row.growth_points || 0),
  }));

  return NextResponse.json({
    auraLeaders,
    growthLeaders,
  });
}
