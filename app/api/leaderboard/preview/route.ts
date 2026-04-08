import { buildCacheControl, getOrSetRuntimeCache } from "@/lib/server/runtime-cache";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationStates, isLeaderboardVisible } from "@/lib/server/profile-moderation";
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

const PREVIEW_CACHE_TTL_MS = 15_000;
const PREVIEW_SECTION_SIZE = 5;
const PREVIEW_FETCH_SIZE = 12;
const PREVIEW_SPOTLIGHT_FETCH_SIZE = 10;

async function loadLeaderboardPreview() {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    throw new Error("SERVER_CONFIG");
  }

  const nowIso = new Date().toISOString();

  const [auraResult, growthResult, spotlightResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, aura_points")
      .order("aura_points", { ascending: false })
      .limit(PREVIEW_FETCH_SIZE),
    admin.rpc("get_growth_leaderboard", { p_days: 7, p_limit: PREVIEW_FETCH_SIZE }),
    admin
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(PREVIEW_SPOTLIGHT_FETCH_SIZE),
  ]);

  if (auraResult.error || growthResult.error || spotlightResult.error) {
    console.error("[Leaderboard API] Failed to load preview", {
      auraError: auraResult.error?.message,
      growthError: growthResult.error?.message,
      spotlightError: spotlightResult.error?.message,
    });

    throw new Error("LOAD_PREVIEW_FAILED");
  }

  const spotlightRows = (spotlightResult.data as SpotlightRow[] | null) || [];
  const uniqueSpotlightRows = Array.from(new Map(spotlightRows.map((row) => [row.profile_id, row])).values());
  const spotlightIds = uniqueSpotlightRows.map((row) => row.profile_id);

  const spotlightProfilesResult = spotlightIds.length
    ? await admin.from("profiles").select("id, username, display_name, aura_points").in("id", spotlightIds)
    : { data: [] as SpotlightProfileRow[], error: null };

  if (spotlightProfilesResult.error) {
    console.error("[Leaderboard API] Failed to load spotlight profiles", spotlightProfilesResult.error.message);
    throw new Error("LOAD_SPOTLIGHT_FAILED");
  }

  const spotlightProfileMap = new Map((spotlightProfilesResult.data || []).map((row) => [row.id, row]));
  const moderationIds = Array.from(
    new Set([
      ...((auraResult.data || []).map((row) => row.id)),
      ...((((growthResult.data as GrowthLeaderRow[] | null) || []).map((row) => row.user_id))),
      ...spotlightIds,
    ]),
  );
  const moderationMap = await getProfileModerationStates(moderationIds);

  return {
    auraLeaders: (auraResult.data || [])
      .filter((row) => isLeaderboardVisible(moderationMap.get(row.id)))
      .slice(0, PREVIEW_SECTION_SIZE)
      .map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        auraPoints: Number(row.aura_points || 0),
      })),
    growthLeaders: ((growthResult.data as GrowthLeaderRow[] | null) || [])
      .filter((row) => isLeaderboardVisible(moderationMap.get(row.user_id)))
      .slice(0, PREVIEW_SECTION_SIZE)
      .map((row) => ({
        id: row.user_id,
        username: row.username,
        displayName: row.display_name || row.username,
        auraPoints: Number(row.aura_points || 0),
        growthPoints: Number(row.growth_points || 0),
      })),
    spotlightLeaders: uniqueSpotlightRows
      .map((row) => {
        const profileRow = spotlightProfileMap.get(row.profile_id);
        if (!profileRow || !isLeaderboardVisible(moderationMap.get(row.profile_id))) return null;

        return {
          id: profileRow.id,
          username: profileRow.username,
          displayName: profileRow.display_name || profileRow.username,
          auraPoints: Number(profileRow.aura_points || 0),
          spotlightUntil: row.expires_at,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, PREVIEW_SECTION_SIZE),
  };
}

export async function GET() {
  try {
    const payload = await getOrSetRuntimeCache("leaderboard-preview:v2", PREVIEW_CACHE_TTL_MS, loadLeaderboardPreview);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": buildCacheControl(PREVIEW_CACHE_TTL_MS),
      },
    });
  } catch (error) {
    await createOpsEvent({
      level: "error",
      scope: "leaderboard",
      eventType: "leaderboard_preview_failed",
      requestPath: "/api/leaderboard/preview",
      message: error instanceof Error ? error.message : "Unknown leaderboard preview error",
    });
    if (error instanceof Error && error.message === "SERVER_CONFIG") {
      return NextResponse.json({ error: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    return NextResponse.json({ error: "Не удалось загрузить лидерборд" }, { status: 500 });
  }
}
