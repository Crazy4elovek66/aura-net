import { buildCacheControl, getOrSetRuntimeCache } from "@/lib/server/runtime-cache";
import { createOpsEvent } from "@/lib/server/ops-events";
import { getProfileModerationStates, isLeaderboardVisible } from "@/lib/server/profile-moderation";
import { buildApiErrorResponse } from "@/lib/server/route-response";
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

interface PresenceStateRow {
  last_rank: number | null;
  updated_at: string;
}

const FULL_CACHE_TTL_MS = 15_000;
const FULL_SECTION_SIZE = 20;
const FULL_FETCH_SIZE = 40;
const FULL_SPOTLIGHT_FETCH_SIZE = 30;
const FULL_WEEKLY_TITLES_SIZE = 12;
const FULL_AROUND_SIZE = 5;
const FULL_AROUND_FETCH_SIZE = 9;
const TIER_TARGETS = [
  { threshold: 501, label: "Герой" },
  { threshold: 2001, label: "Тот самый" },
  { threshold: 5001, label: "Сигма" },
];

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNextTier(auraPoints: number) {
  return TIER_TARGETS.find((tier) => auraPoints < tier.threshold) ?? null;
}

async function loadPublicLeaderboardData() {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    throw new Error("SERVER_CONFIG");
  }

  const nowIso = new Date().toISOString();

  const [allTimeResult, growth7Result, growth24Result, spotlightResult, weeklyTitlesResult] = await Promise.all([
    admin.rpc("get_aura_leaderboard", { p_limit: FULL_FETCH_SIZE, p_offset: 0 }),
    admin.rpc("get_growth_leaderboard", { p_days: 7, p_limit: FULL_FETCH_SIZE }),
    admin.rpc("get_growth_leaderboard", { p_days: 1, p_limit: FULL_FETCH_SIZE }),
    admin
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(FULL_SPOTLIGHT_FETCH_SIZE),
    admin.rpc("get_active_weekly_titles", { p_limit: FULL_WEEKLY_TITLES_SIZE * 2 }),
  ]);

  if (allTimeResult.error || growth7Result.error || growth24Result.error || spotlightResult.error || weeklyTitlesResult.error) {
    console.error("[Leaderboard Full API] Failed to load leaderboard", {
      allTimeError: allTimeResult.error?.message,
      growth7Error: growth7Result.error?.message,
      growth24Error: growth24Result.error?.message,
      spotlightError: spotlightResult.error?.message,
      weeklyTitlesError: weeklyTitlesResult.error?.message,
    });

    throw new Error("LOAD_FULL_LEADERBOARD_FAILED");
  }

  const spotlightRows = (spotlightResult.data as SpotlightRow[] | null) || [];
  const uniqueSpotlightRows = Array.from(new Map(spotlightRows.map((row) => [row.profile_id, row])).values());
  const spotlightIds = uniqueSpotlightRows.map((row) => row.profile_id);

  const spotlightProfilesResult = spotlightIds.length
    ? await admin.from("profiles").select("id, username, display_name, aura_points").in("id", spotlightIds)
    : { data: [] as SpotlightProfileRow[], error: null };

  if (spotlightProfilesResult.error) {
    console.error("[Leaderboard Full API] Failed to load spotlight profiles", spotlightProfilesResult.error.message);
    throw new Error("LOAD_SPOTLIGHT_FAILED");
  }

  const spotlightMap = new Map((spotlightProfilesResult.data || []).map((row) => [row.id, row]));
  const moderationIds = Array.from(
    new Set([
      ...((((allTimeResult.data as AuraLeaderboardRow[] | null) || []).map((row) => row.profile_id))),
      ...((((growth7Result.data as GrowthLeaderboardRow[] | null) || []).map((row) => row.user_id))),
      ...((((growth24Result.data as GrowthLeaderboardRow[] | null) || []).map((row) => row.user_id))),
      ...spotlightIds,
      ...((((weeklyTitlesResult.data as WeeklyTitleRow[] | null) || []).map((row) => row.profile_id))),
    ]),
  );
  const moderationMap = await getProfileModerationStates(moderationIds);

  return {
    generatedAt: new Date().toISOString(),
    tabs: {
      allTime: ((allTimeResult.data as AuraLeaderboardRow[] | null) || [])
        .filter((row) => isLeaderboardVisible(moderationMap.get(row.profile_id)))
        .slice(0, FULL_SECTION_SIZE)
        .map((row, index) => ({
          rank: index + 1,
          id: row.profile_id,
          username: row.username,
          displayName: row.display_name,
          auraPoints: asNumber(row.aura_points),
        })),
      growth7d: ((growth7Result.data as GrowthLeaderboardRow[] | null) || [])
        .filter((row) => isLeaderboardVisible(moderationMap.get(row.user_id)))
        .slice(0, FULL_SECTION_SIZE)
        .map((row, index) => ({
          rank: index + 1,
          id: row.user_id,
          username: row.username,
          displayName: row.display_name || row.username,
          auraPoints: asNumber(row.aura_points),
          growthPoints: asNumber(row.growth_points),
        })),
      growth24h: ((growth24Result.data as GrowthLeaderboardRow[] | null) || [])
        .filter((row) => isLeaderboardVisible(moderationMap.get(row.user_id)))
        .slice(0, FULL_SECTION_SIZE)
        .map((row, index) => ({
          rank: index + 1,
          id: row.user_id,
          username: row.username,
          displayName: row.display_name || row.username,
          auraPoints: asNumber(row.aura_points),
          growthPoints: asNumber(row.growth_points),
        })),
      spotlight: uniqueSpotlightRows
        .map((row) => {
          const profile = spotlightMap.get(row.profile_id);
          if (!profile || !isLeaderboardVisible(moderationMap.get(row.profile_id))) {
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
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .slice(0, FULL_SECTION_SIZE),
      weeklyTitles: ((weeklyTitlesResult.data as WeeklyTitleRow[] | null) || [])
        .filter((row) => isLeaderboardVisible(moderationMap.get(row.profile_id)))
        .slice(0, FULL_WEEKLY_TITLES_SIZE)
        .map((row) => ({
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
        })),
    },
    live: {
      cutlineTop10: ((allTimeResult.data as AuraLeaderboardRow[] | null) || [])
        .filter((row) => isLeaderboardVisible(moderationMap.get(row.profile_id)))
        .slice(7, 12)
        .map((row, index) => ({
          rank: index + 8,
          id: row.profile_id,
          username: row.username,
          displayName: row.display_name,
          auraPoints: asNumber(row.aura_points),
        })),
      nearTier: ((allTimeResult.data as AuraLeaderboardRow[] | null) || [])
        .filter((row) => isLeaderboardVisible(moderationMap.get(row.profile_id)))
        .map((row, index) => {
          const auraPoints = asNumber(row.aura_points);
          const tier = getNextTier(auraPoints);

          if (!tier) {
            return null;
          }

          return {
            rank: index + 1,
            id: row.profile_id,
            username: row.username,
            displayName: row.display_name,
            auraPoints,
            tierLabel: tier.label,
            pointsToTier: tier.threshold - auraPoints,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((left, right) => left.pointsToTier - right.pointsToTier)
        .slice(0, 6),
    },
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const payload = await getOrSetRuntimeCache("leaderboard-full:v2", FULL_CACHE_TTL_MS, loadPublicLeaderboardData);
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
      returnPulse: {
        trackedAt: string | null;
        previousRank: number | null;
        auraDelta: number;
        newAchievements: number;
        newMoments: number;
        pendingEvents: number;
      } | null;
    } | null = null;

    if (user) {
      const [{ data: contextData, error: contextError }, { data: presenceState }] = await Promise.all([
        supabase.rpc("get_profile_leaderboard_context", { p_profile_id: user.id, p_top_target: 10 }).maybeSingle(),
        supabase.from("leaderboard_presence_states").select("last_rank, updated_at").eq("profile_id", user.id).maybeSingle(),
      ]);

      if (contextError) {
        console.error("[Leaderboard Full API] Failed to load personal context", contextError.message);
      } else if (contextData) {
        const context = contextData as ProfileLeaderboardContextRow;
        const rank = asNumber(context.rank_position);
        const aroundOffset = Math.max(rank - 3, 0);
        const admin = createAdminClient();
        const aroundResult = await admin.rpc("get_aura_leaderboard", {
          p_limit: FULL_AROUND_FETCH_SIZE,
          p_offset: aroundOffset,
        });

        if (aroundResult.error) {
          console.error("[Leaderboard Full API] Failed to load around user slice", aroundResult.error.message);
          await createOpsEvent({
            level: "error",
            scope: "leaderboard",
            eventType: "leaderboard_around_slice_failed",
            profileId: user.id,
            message: aroundResult.error.message,
          });
        }

        const contextRelatedIds = [
          ...(((aroundResult.data as AuraLeaderboardRow[] | null) || []).map((row) => row.profile_id)),
          context.above_profile_id,
          context.below_profile_id,
        ].filter((value): value is string => Boolean(value));
        const moderationMap = await getProfileModerationStates(contextRelatedIds);
        const visibleAbove = context.above_profile_id && isLeaderboardVisible(moderationMap.get(context.above_profile_id));
        const visibleBelow = context.below_profile_id && isLeaderboardVisible(moderationMap.get(context.below_profile_id));
        const trackedState = (presenceState as PresenceStateRow | null) || null;
        const trackedAt = trackedState?.updated_at ?? null;
        const trackedSinceDate = trackedAt ?? null;
        const [transactionsSinceTracked, achievementsSinceTracked, momentsSinceTracked, pendingEventsResult] = trackedSinceDate
          ? await Promise.all([
              supabase.from("transactions").select("amount").eq("user_id", user.id).gt("created_at", trackedSinceDate),
              supabase
                .from("user_achievements")
                .select("achievement_key", { count: "exact", head: true })
                .eq("user_id", user.id)
                .gt("unlocked_at", trackedSinceDate),
              supabase
                .from("shareable_moments")
                .select("id", { count: "exact", head: true })
                .eq("profile_id", user.id)
                .gt("created_at", trackedSinceDate),
              supabase
                .from("notification_events")
                .select("id", { count: "exact", head: true })
                .eq("profile_id", user.id)
                .in("status", ["pending", "processing"]),
            ])
          : [{ data: [] as Array<{ amount: number }> }, { count: 0 }, { count: 0 }, { count: 0 }];
        const auraDelta = trackedSinceDate
          ? (((transactionsSinceTracked.data as Array<{ amount: number }> | null) || []) as Array<{
              amount: number;
            }>).reduce((sum, row) => sum + asNumber(row.amount), 0)
          : 0;
        personalContext = {
          profileId: context.profile_id,
          username: context.username,
          displayName: context.display_name,
          rank,
          auraPoints: asNumber(context.aura_points),
          distanceToNext: asNumber(context.distance_to_next),
          distanceToTop10: asNumber(context.distance_to_top_target),
          above: context.above_profile_id && visibleAbove
            ? {
                id: context.above_profile_id,
                username: context.above_username || "",
                displayName: context.above_display_name || context.above_username || "",
                auraPoints: asNumber(context.above_aura_points),
              }
            : null,
          below: context.below_profile_id && visibleBelow
            ? {
                id: context.below_profile_id,
                username: context.below_username || "",
                displayName: context.below_display_name || context.below_username || "",
                auraPoints: asNumber(context.below_aura_points),
              }
            : null,
          aroundYou: ((aroundResult.data as AuraLeaderboardRow[] | null) || [])
            .filter((row) => isLeaderboardVisible(moderationMap.get(row.profile_id)))
            .map((row) => ({
              rank: asNumber(row.rank_position),
              id: row.profile_id,
              username: row.username,
              displayName: row.display_name,
              auraPoints: asNumber(row.aura_points),
            }))
            .slice(0, FULL_AROUND_SIZE),
          returnPulse: trackedSinceDate
            ? {
                trackedAt,
                previousRank: trackedState?.last_rank ?? null,
                auraDelta,
                newAchievements: Number(achievementsSinceTracked.count || 0),
                newMoments: Number(momentsSinceTracked.count || 0),
                pendingEvents: Number(pendingEventsResult.count || 0),
              }
            : null,
        };
      }
    }

    return NextResponse.json(
      {
        ...payload,
        personalContext,
      },
      {
        headers: {
          "Cache-Control": user ? "private, no-store" : buildCacheControl(FULL_CACHE_TTL_MS),
        },
      },
    );
  } catch (error) {
    await createOpsEvent({
      level: "error",
      scope: "leaderboard",
      eventType: "leaderboard_full_failed",
      requestPath: "/api/leaderboard/full",
      message: error instanceof Error ? error.message : "Unknown leaderboard full error",
    });
    if (error instanceof Error && error.message === "SERVER_CONFIG") {
      return buildApiErrorResponse(500, "Ошибка конфигурации сервера.", {
        code: "SERVER_CONFIG",
      });
    }

    return buildApiErrorResponse(500, "Не удалось загрузить полную гонку.", {
      code: "LEADERBOARD_FULL_FAILED",
    });
  }
}
