import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface GrowthLeaderRow {
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

export async function GET() {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Ошибка конфигурации сервера" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const [auraResult, growthResult, spotlightResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, aura_points")
      .order("aura_points", { ascending: false })
      .limit(5),
    admin.rpc("get_growth_leaderboard", { p_days: 7, p_limit: 5 }),
    admin
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(5),
  ]);

  if (auraResult.error || growthResult.error || spotlightResult.error) {
    console.error("[Leaderboard API] Failed to load preview", {
      auraError: auraResult.error?.message,
      growthError: growthResult.error?.message,
      spotlightError: spotlightResult.error?.message,
    });

    return NextResponse.json({ error: "Не удалось загрузить лидерборд" }, { status: 500 });
  }

  const spotlightRows = (spotlightResult.data as SpotlightRow[] | null) || [];
  const uniqueSpotlightRows = Array.from(
    new Map(spotlightRows.map((row) => [row.profile_id, row])).values(),
  );
  const spotlightIds = uniqueSpotlightRows.map((row) => row.profile_id);

  const spotlightProfilesResult = spotlightIds.length
    ? await admin.from("profiles").select("id, username, display_name, aura_points").in("id", spotlightIds)
    : { data: [] as SpotlightProfileRow[], error: null };

  if (spotlightProfilesResult.error) {
    console.error("[Leaderboard API] Failed to load spotlight profiles", spotlightProfilesResult.error.message);
    return NextResponse.json({ error: "Не удалось загрузить раздел «В фокусе»" }, { status: 500 });
  }

  const spotlightProfileMap = new Map((spotlightProfilesResult.data || []).map((row) => [row.id, row]));

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

  const spotlightLeaders = uniqueSpotlightRows
    .map((row) => {
      const profileRow = spotlightProfileMap.get(row.profile_id);
      if (!profileRow) return null;

      return {
        id: profileRow.id,
        username: profileRow.username,
        displayName: profileRow.display_name || profileRow.username,
        auraPoints: Number(profileRow.aura_points || 0),
        spotlightUntil: row.expires_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return NextResponse.json({
    auraLeaders,
    growthLeaders,
    spotlightLeaders,
  });
}

