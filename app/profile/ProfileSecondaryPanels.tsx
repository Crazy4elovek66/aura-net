import AuraTransactions from "@/components/AuraTransactions";
import LeaderboardPreview from "@/components/LeaderboardPreview";
import ProfileRaceCard from "@/components/ProfileRaceCard";
import ReengagementEventsCard from "@/components/ReengagementEventsCard";
import ShareableMomentsCard from "@/components/ShareableMomentsCard";
import { createClient } from "@/lib/supabase/server";

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

interface NotificationEventRow {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
  scheduled_for: string;
  payload?: Record<string, unknown>;
}

interface ShareableMomentRow {
  id: string;
  moment_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface ProfileLeaderboardContextRow {
  profile_id: string;
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

interface WeeklyTitleRow {
  title_key: string;
  title: string;
  profile_id: string;
}

const WEEKLY_TITLE_LABELS: Record<string, string> = {
  weekly_aura_champion: "Чемп ауры",
  weekly_rise_rocket: "Ракета роста",
  weekly_hype_pulse: "Пульс хайпа",
};

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function ProfileSecondaryPanels({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    spotlightResult,
    auraLeadersResult,
    growthLeadersResult,
    transactionsResult,
    reengagementEventsResult,
    shareableMomentsResult,
    raceContextResult,
    weeklyTitlesResult,
  ] = await Promise.all([
    supabase
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("id, username, display_name, aura_points")
      .order("aura_points", { ascending: false })
      .limit(5),
    supabase.rpc("get_growth_leaderboard", { p_days: 7, p_limit: 5 }),
    supabase
      .from("transactions")
      .select("id, amount, type, description, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notification_events")
      .select("id, event_type, status, created_at, scheduled_for, payload")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("shareable_moments")
      .select("id, moment_type, payload, created_at")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.rpc("get_profile_leaderboard_context", { p_profile_id: userId, p_top_target: 10 }).maybeSingle(),
    supabase.rpc("get_active_weekly_titles", { p_limit: 12 }),
  ]);

  const spotlightRows = (spotlightResult.data as SpotlightRow[] | null) || [];
  const uniqueSpotlightRows = Array.from(new Map(spotlightRows.map((row) => [row.profile_id, row])).values());
  const spotlightIds = uniqueSpotlightRows.map((row) => row.profile_id);

  const spotlightProfilesResult = spotlightIds.length
    ? await supabase.from("profiles").select("id, username, display_name, aura_points").in("id", spotlightIds)
    : { data: [] as SpotlightProfileRow[] };

  const spotlightProfileMap = new Map((spotlightProfilesResult.data || []).map((row) => [row.id, row]));
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

  const auraLeaders = (auraLeadersResult.data || []).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: Number(row.aura_points || 0),
  }));

  const growthLeaders = ((growthLeadersResult.data as GrowthLeaderRow[] | null) || []).map((row) => ({
    id: row.user_id,
    username: row.username,
    displayName: row.display_name || row.username,
    auraPoints: Number(row.aura_points || 0),
    growthPoints: Number(row.growth_points || 0),
  }));

  if (raceContextResult.error) {
    console.error("[Profile Page] Failed to load race context", raceContextResult.error.message);
  }

  if (weeklyTitlesResult.error) {
    console.error("[Profile Page] Failed to load weekly titles", weeklyTitlesResult.error.message);
  }

  const raceContextRaw = (raceContextResult.data || null) as ProfileLeaderboardContextRow | null;
  const raceContext = raceContextRaw
    ? {
        profileId: raceContextRaw.profile_id,
        rank: asNumber(raceContextRaw.rank_position),
        distanceToNext: asNumber(raceContextRaw.distance_to_next),
        distanceToTop10: asNumber(raceContextRaw.distance_to_top_target),
        above: raceContextRaw.above_profile_id
          ? {
              id: raceContextRaw.above_profile_id,
              username: raceContextRaw.above_username || "",
              displayName: raceContextRaw.above_display_name || raceContextRaw.above_username || "",
              auraPoints: asNumber(raceContextRaw.above_aura_points),
            }
          : null,
        below: raceContextRaw.below_profile_id
          ? {
              id: raceContextRaw.below_profile_id,
              username: raceContextRaw.below_username || "",
              displayName: raceContextRaw.below_display_name || raceContextRaw.below_username || "",
              auraPoints: asNumber(raceContextRaw.below_aura_points),
            }
          : null,
      }
    : null;

  const weeklyTitles = ((weeklyTitlesResult.data as WeeklyTitleRow[] | null) || [])
    .filter((row) => row.profile_id === userId)
    .map((row) => ({
      key: row.title_key,
      title: WEEKLY_TITLE_LABELS[row.title_key] || row.title,
    }));

  return (
    <>
      <ProfileRaceCard raceContext={raceContext} weeklyTitles={weeklyTitles} />
      <ReengagementEventsCard events={(reengagementEventsResult.data as NotificationEventRow[] | null) || []} />
      <ShareableMomentsCard moments={(shareableMomentsResult.data as ShareableMomentRow[] | null) || []} />
      <LeaderboardPreview
        auraLeaders={auraLeaders}
        growthLeaders={growthLeaders}
        spotlightLeaders={spotlightLeaders}
        currentUserId={userId}
      />
      <AuraTransactions transactions={transactionsResult.data || []} />
    </>
  );
}
