import { buildCacheControl, getOrSetRuntimeCache } from "@/lib/server/runtime-cache";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationStates, isDiscoverVisible } from "@/lib/server/profile-moderation";
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

const DISCOVER_CACHE_TTL_MS = 15_000;
const DISCOVER_SECTION_SIZE = 12;
const DISCOVER_FETCH_SIZE = 24;
const DISCOVER_AROUND_SIZE = 8;
const DISCOVER_AROUND_FETCH_SIZE = 12;

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadPublicDiscoverData() {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    throw new Error("SERVER_CONFIG");
  }

  const [newProfilesResult, hypeResult, growth24Result] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, aura_points, created_at")
      .order("created_at", { ascending: false })
      .limit(DISCOVER_FETCH_SIZE),
    admin.rpc("get_hype_profiles", { p_hours: 24, p_limit: DISCOVER_FETCH_SIZE }),
    admin.rpc("get_growth_leaderboard", { p_days: 1, p_limit: DISCOVER_FETCH_SIZE }),
  ]);

  if (newProfilesResult.error || hypeResult.error || growth24Result.error) {
    console.error("[Discover API] Failed to load discover datasets", {
      newProfilesError: newProfilesResult.error?.message,
      hypeError: hypeResult.error?.message,
      growth24Error: growth24Result.error?.message,
    });

    throw new Error("LOAD_DISCOVER_FAILED");
  }

  const moderationIds = Array.from(
    new Set([
      ...(((newProfilesResult.data as NewProfileRow[] | null) || []).map((row) => row.id)),
      ...((((hypeResult.data as HypeProfileRow[] | null) || []).map((row) => row.profile_id))),
      ...((((growth24Result.data as GrowthRow[] | null) || []).map((row) => row.user_id))),
    ]),
  );
  const moderationMap = await getProfileModerationStates(moderationIds);

  return {
    generatedAt: new Date().toISOString(),
    sections: {
      aroundYou: [] as Array<{
        rank: number;
        id: string;
        username: string;
        displayName: string;
        auraPoints: number;
      }>,
      hypeProfiles: ((hypeResult.data as HypeProfileRow[] | null) || [])
        .filter((row) => isDiscoverVisible(moderationMap.get(row.profile_id)))
        .slice(0, DISCOVER_SECTION_SIZE)
        .map((row) => ({
          id: row.profile_id,
          username: row.username,
          displayName: row.display_name || row.username,
          auraPoints: asNumber(row.aura_points),
          votesTotal: asNumber(row.votes_total),
          votesUp: asNumber(row.votes_up),
          votesDown: asNumber(row.votes_down),
          netVotes: asNumber(row.net_votes),
        })),
      growth24h: ((growth24Result.data as GrowthRow[] | null) || [])
        .filter((row) => isDiscoverVisible(moderationMap.get(row.user_id)))
        .slice(0, DISCOVER_SECTION_SIZE)
        .map((row, index) => ({
          rank: index + 1,
          id: row.user_id,
          username: row.username,
          displayName: row.display_name || row.username,
          auraPoints: asNumber(row.aura_points),
          growthPoints: asNumber(row.growth_points),
        })),
      newProfiles: ((newProfilesResult.data as NewProfileRow[] | null) || [])
        .filter((row) => isDiscoverVisible(moderationMap.get(row.id)))
        .slice(0, DISCOVER_SECTION_SIZE)
        .map((row) => ({
          id: row.id,
          username: row.username,
          displayName: row.display_name || row.username,
          auraPoints: asNumber(row.aura_points),
          createdAt: row.created_at,
        })),
    },
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const payload = await getOrSetRuntimeCache("discover:v2", DISCOVER_CACHE_TTL_MS, loadPublicDiscoverData);

    if (!user) {
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": buildCacheControl(DISCOVER_CACHE_TTL_MS),
        },
      });
    }

    const { data: contextData, error: contextError } = await supabase
      .rpc("get_profile_leaderboard_context", { p_profile_id: user.id, p_top_target: 10 })
      .maybeSingle();

    let aroundYou = payload.sections.aroundYou;

    if (contextError) {
      console.error("[Discover API] Failed to load personal leaderboard context", contextError.message);
    } else if (contextData) {
      const context = contextData as ProfileLeaderboardContextRow;
      const rank = asNumber(context.rank_position);
      const aroundOffset = Math.max(rank - 4, 0);
      const admin = createAdminClient();
        const aroundResult = await admin.rpc("get_aura_leaderboard", {
          p_limit: DISCOVER_AROUND_FETCH_SIZE,
          p_offset: aroundOffset,
        });

      if (aroundResult.error) {
        console.error("[Discover API] Failed to load around profiles", aroundResult.error.message);
        await createOpsEvent({
          level: "error",
          scope: "discover",
          eventType: "around_profiles_failed",
          profileId: user.id,
          message: aroundResult.error.message,
        });
      } else {
        const aroundRows = ((aroundResult.data as AuraLeaderboardRow[] | null) || []);
        const moderationMap = await getProfileModerationStates(aroundRows.map((row) => row.profile_id));
        aroundYou = aroundRows
          .filter((row) => isDiscoverVisible(moderationMap.get(row.profile_id)))
          .map((row) => ({
            rank: asNumber(row.rank_position),
            id: row.profile_id,
            username: row.username,
            displayName: row.display_name,
            auraPoints: asNumber(row.aura_points),
          }))
          .filter((row) => row.id !== user.id)
          .slice(0, DISCOVER_AROUND_SIZE);
      }
    }

    return NextResponse.json(
      {
        ...payload,
        sections: {
          ...payload.sections,
          aroundYou,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    await createOpsEvent({
      level: "error",
      scope: "discover",
      eventType: "discover_route_failed",
      requestPath: "/api/discover",
      message: error instanceof Error ? error.message : "Unknown discover error",
    });
    if (error instanceof Error && error.message === "SERVER_CONFIG") {
      return NextResponse.json({ error: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    return NextResponse.json({ error: "Не удалось загрузить раздел «Разведка»" }, { status: 500 });
  }
}
