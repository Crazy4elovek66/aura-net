import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface AuraLeaderboardRow {
  rank_position: number | string;
  profile_id: string;
  username: string;
  display_name: string;
  aura_points: number;
}

interface GrowthLeaderboardRow {
  user_id: string;
  username: string;
  display_name: string;
  aura_points: number;
  growth_points: number;
}

interface SpotlightRow {
  profile_id: string;
  expires_at: string;
}

interface SpotlightProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  aura_points: number;
}

interface WeeklyTitleRow {
  title_key: string;
  title: string;
  description: string;
  icon: string | null;
  profile_id: string;
  username: string;
  display_name: string;
  aura_points: number;
  score: number;
  week_start: string;
  week_end: string;
}

const WEEKLY_TITLE_LABELS: Record<string, string> = {
  weekly_aura_champion: "Чемп ауры",
  weekly_rise_rocket: "Ракета роста",
  weekly_hype_pulse: "Пульс хайпа",
};

interface ProfileLeaderboardContextRow {
  profile_id: string;
  username: string;
  display_name: string;
  aura_points: number;
  rank_position: number | string;
  distance_to_next: number;
  distance_to_top_target: number;
  above_profile_id: string | null;
  above_username: string | null;
  above_display_name: string | null;
  above_aura_points: number | null;
  below_profile_id: string | null;
  below_username: string | null;
  below_display_name: string | null;
  below_aura_points: number | null;
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

  const nowIso = new Date().toISOString();

  const [allTimeResult, growth7Result, growth24Result, spotlightResult, weeklyTitlesResult] = await Promise.all([
    admin.rpc("get_aura_leaderboard", { p_limit: 20, p_offset: 0 }),
    admin.rpc("get_growth_leaderboard", { p_days: 7, p_limit: 20 }),
    admin.rpc("get_growth_leaderboard", { p_days: 1, p_limit: 20 }),
    admin
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(20),
    admin.rpc("get_active_weekly_titles", { p_limit: 12 }),
  ]);

  if (allTimeResult.error || growth7Result.error || growth24Result.error || spotlightResult.error || weeklyTitlesResult.error) {
    console.error("[Leaderboard Full API] Failed to load leaderboard", {
      allTimeError: allTimeResult.error?.message,
      growth7Error: growth7Result.error?.message,
      growth24Error: growth24Result.error?.message,
      spotlightError: spotlightResult.error?.message,
      weeklyTitlesError: weeklyTitlesResult.error?.message,
    });

    return NextResponse.json({ error: "Не удалось загрузить полную гонку" }, { status: 500 });
  }

  const spotlightRows = (spotlightResult.data as SpotlightRow[] | null) || [];
  const uniqueSpotlightRows = Array.from(new Map(spotlightRows.map((row) => [row.profile_id, row])).values());
  const spotlightIds = uniqueSpotlightRows.map((row) => row.profile_id);

  const spotlightProfilesResult = spotlightIds.length
    ? await admin.from("profiles").select("id, username, display_name, aura_points").in("id", spotlightIds)
    : { data: [] as SpotlightProfileRow[], error: null };

  if (spotlightProfilesResult.error) {
    console.error("[Leaderboard Full API] Failed to load spotlight profiles", spotlightProfilesResult.error.message);
    return NextResponse.json({ error: "Не удалось загрузить профили в фокусе" }, { status: 500 });
  }

  const spotlightMap = new Map((spotlightProfilesResult.data || []).map((row) => [row.id, row]));

  const allTime = ((allTimeResult.data as AuraLeaderboardRow[] | null) || []).map((row) => ({
    rank: asNumber(row.rank_position),
    id: row.profile_id,
    username: row.username,
    displayName: row.display_name,
    auraPoints: asNumber(row.aura_points),
  }));

  const growth7d = ((growth7Result.data as GrowthLeaderboardRow[] | null) || []).map((row, index) => ({
    rank: index + 1,
    id: row.user_id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: asNumber(row.aura_points),
    growthPoints: asNumber(row.growth_points),
  }));

  const growth24h = ((growth24Result.data as GrowthLeaderboardRow[] | null) || []).map((row, index) => ({
    rank: index + 1,
    id: row.user_id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: asNumber(row.aura_points),
    growthPoints: asNumber(row.growth_points),
  }));

  const spotlight = uniqueSpotlightRows
    .map((row) => {
      const profile = spotlightMap.get(row.profile_id);
      if (!profile) {
        return null;
      }

      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name || profile.username,
        auraPoints: asNumber(profile.aura_points),
        spotlightUntil: row.expires_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const weeklyTitles = ((weeklyTitlesResult.data as WeeklyTitleRow[] | null) || []).map((row) => ({
    key: row.title_key,
    title: WEEKLY_TITLE_LABELS[row.title_key] || row.title,
    description: row.description,
    icon: row.icon,
    score: asNumber(row.score),
    weekStart: row.week_start,
    weekEnd: row.week_end,
    profile: {
      id: row.profile_id,
      username: row.username,
      displayName: row.display_name,
      auraPoints: asNumber(row.aura_points),
    },
  }));

  let personalContext: {
    profileId: string;
    username: string;
    displayName: string;
    rank: number;
    auraPoints: number;
    distanceToNext: number;
    distanceToTop10: number;
    above: { id: string; username: string; displayName: string; auraPoints: number } | null;
    below: { id: string; username: string; displayName: string; auraPoints: number } | null;
    aroundYou: Array<{ rank: number; id: string; username: string; displayName: string; auraPoints: number }>;
  } | null = null;

  if (user) {
    const { data: contextData, error: contextError } = await supabase
      .rpc("get_profile_leaderboard_context", { p_profile_id: user.id, p_top_target: 10 })
      .maybeSingle();

    if (contextError) {
      console.error("[Leaderboard Full API] Failed to load personal context", contextError.message);
    } else if (contextData) {
      const context = contextData as ProfileLeaderboardContextRow;
      const rank = asNumber(context.rank_position);
      const aroundOffset = Math.max(rank - 3, 0);

      const aroundResult = await admin.rpc("get_aura_leaderboard", {
        p_limit: 5,
        p_offset: aroundOffset,
      });

      if (aroundResult.error) {
        console.error("[Leaderboard Full API] Failed to load around user slice", aroundResult.error.message);
      }

      const aroundYou = ((aroundResult.data as AuraLeaderboardRow[] | null) || []).map((row) => ({
        rank: asNumber(row.rank_position),
        id: row.profile_id,
        username: row.username,
        displayName: row.display_name,
        auraPoints: asNumber(row.aura_points),
      }));

      personalContext = {
        profileId: context.profile_id,
        username: context.username,
        displayName: context.display_name,
        rank,
        auraPoints: asNumber(context.aura_points),
        distanceToNext: asNumber(context.distance_to_next),
        distanceToTop10: asNumber(context.distance_to_top_target),
        above: context.above_profile_id
          ? {
              id: context.above_profile_id,
              username: context.above_username || "",
              displayName: context.above_display_name || context.above_username || "",
              auraPoints: asNumber(context.above_aura_points),
            }
          : null,
        below: context.below_profile_id
          ? {
              id: context.below_profile_id,
              username: context.below_username || "",
              displayName: context.below_display_name || context.below_username || "",
              auraPoints: asNumber(context.below_aura_points),
            }
          : null,
        aroundYou,
      };
    }
  }

  return NextResponse.json({
    generatedAt: nowIso,
    tabs: {
      allTime,
      growth7d,
      growth24h,
      spotlight,
      weeklyTitles,
    },
    personalContext,
  });
}
