import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface NewProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  aura_points: number;
  created_at: string;
}

interface HypeProfileRow {
  profile_id: string;
  username: string;
  display_name: string;
  aura_points: number;
  votes_total: number;
  votes_up: number;
  votes_down: number;
  net_votes: number;
}

interface GrowthRow {
  user_id: string;
  username: string;
  display_name: string;
  aura_points: number;
  growth_points: number;
}

interface AuraLeaderboardRow {
  rank_position: number | string;
  profile_id: string;
  username: string;
  display_name: string;
  aura_points: number;
}

interface ProfileLeaderboardContextRow {
  rank_position: number | string;
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Ошибка конфигурации сервера" }, { status: 500 });
  }

  const [newProfilesResult, hypeResult, growth24Result] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, aura_points, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    admin.rpc("get_hype_profiles", { p_hours: 24, p_limit: 12 }),
    admin.rpc("get_growth_leaderboard", { p_days: 1, p_limit: 12 }),
  ]);

  if (newProfilesResult.error || hypeResult.error || growth24Result.error) {
    console.error("[Discover API] Failed to load discover datasets", {
      newProfilesError: newProfilesResult.error?.message,
      hypeError: hypeResult.error?.message,
      growth24Error: growth24Result.error?.message,
    });

    return NextResponse.json({ error: "Не удалось загрузить раздел «Разведка»" }, { status: 500 });
  }

  const newProfiles = ((newProfilesResult.data as NewProfileRow[] | null) || []).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: asNumber(row.aura_points),
    createdAt: row.created_at,
  }));

  const hypeProfiles = ((hypeResult.data as HypeProfileRow[] | null) || []).map((row) => ({
    id: row.profile_id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: asNumber(row.aura_points),
    votesTotal: asNumber(row.votes_total),
    votesUp: asNumber(row.votes_up),
    votesDown: asNumber(row.votes_down),
    netVotes: asNumber(row.net_votes),
  }));

  const growth24h = ((growth24Result.data as GrowthRow[] | null) || []).map((row, index) => ({
    rank: index + 1,
    id: row.user_id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: asNumber(row.aura_points),
    growthPoints: asNumber(row.growth_points),
  }));

  let aroundYou: Array<{
    rank: number;
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
  }> = [];

  if (user) {
    const { data: contextData, error: contextError } = await supabase
      .rpc("get_profile_leaderboard_context", { p_profile_id: user.id, p_top_target: 10 })
      .maybeSingle();

    if (contextError) {
      console.error("[Discover API] Failed to load personal leaderboard context", contextError.message);
    } else if (contextData) {
      const context = contextData as ProfileLeaderboardContextRow;
      const rank = asNumber(context.rank_position);
      const aroundOffset = Math.max(rank - 4, 0);

      const aroundResult = await admin.rpc("get_aura_leaderboard", {
        p_limit: 8,
        p_offset: aroundOffset,
      });

      if (aroundResult.error) {
        console.error("[Discover API] Failed to load around profiles", aroundResult.error.message);
      } else {
        aroundYou = ((aroundResult.data as AuraLeaderboardRow[] | null) || [])
          .map((row) => ({
            rank: asNumber(row.rank_position),
            id: row.profile_id,
            username: row.username,
            displayName: row.display_name,
            auraPoints: asNumber(row.aura_points),
          }))
          .filter((row) => row.id !== user.id);
      }
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sections: {
      aroundYou,
      hypeProfiles,
      growth24h,
      newProfiles,
    },
  });
}
