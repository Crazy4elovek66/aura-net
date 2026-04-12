import AuraTransactions from "@/components/AuraTransactions";
import InviteLoopCard from "@/components/InviteLoopCard";
import LeaderboardPreview from "@/components/LeaderboardPreview";
import MyCircleCard from "@/components/MyCircleCard";
import ProfileRaceCard from "@/components/ProfileRaceCard";
import ReengagementEventsCard from "@/components/ReengagementEventsCard";
import ReturnPulseCard from "@/components/ReturnPulseCard";
import ShareButton from "@/components/ShareButton";
import ShareableMomentsCard from "@/components/ShareableMomentsCard";
import { createClient } from "@/lib/supabase/server";
import CopyLink from "./CopyLink";
import type { ProfileTabKey } from "./profile-tabs";

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

interface PresenceStateRow {
  last_rank: number | null;
  updated_at: string;
}

interface CircleProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  aura_points: number;
}

interface ReferralEntry {
  id: string;
  inviteeId: string;
  inviteeUsername: string | null;
  inviteeDisplayName: string;
  status: "pending" | "activated" | "rejected";
  joinedAt: string;
  activatedAt: string | null;
  inviterReward: number;
  inviteeReward: number;
  hasFirstClaim: boolean;
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
  activeTab,
  userId,
  auraPoints,
  dailyStreak,
  referredById,
  profileUsername,
  displayName,
  profileShareLink,
  inviteLink,
  inviteCode,
  telegramInviteLink,
  referrals,
}: {
  activeTab: Extract<ProfileTabKey, "progress" | "circle" | "history">;
  userId: string;
  auraPoints: number;
  dailyStreak: number;
  referredById: string | null;
  profileUsername: string;
  displayName: string;
  profileShareLink: string;
  inviteLink: string | null;
  inviteCode: string | null;
  telegramInviteLink: string | null;
  referrals: ReferralEntry[];
}) {
  const supabase = await createClient();

  if (activeTab === "progress") {
    const [raceContextResult, weeklyTitlesResult, presenceStateResult] = await Promise.all([
      supabase.rpc("get_profile_leaderboard_context", { p_profile_id: userId, p_top_target: 10 }).maybeSingle(),
      supabase.rpc("get_active_weekly_titles", { p_limit: 12 }),
      supabase.from("leaderboard_presence_states").select("last_rank, updated_at").eq("profile_id", userId).maybeSingle(),
    ]);

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

    const presenceState = (presenceStateResult.data as PresenceStateRow | null) || null;
    const trackedAt = presenceState?.updated_at ?? null;
    const trackedSinceDate = trackedAt ?? null;
    const [transactionsSinceTrackedResult, achievementsSinceTrackedResult, momentsSinceTrackedResult, pendingEventsResult] =
      trackedSinceDate
        ? await Promise.all([
            supabase.from("transactions").select("amount").eq("user_id", userId).gt("created_at", trackedSinceDate),
            supabase
              .from("user_achievements")
              .select("achievement_key", { count: "exact", head: true })
              .eq("user_id", userId)
              .gt("unlocked_at", trackedSinceDate),
            supabase
              .from("shareable_moments")
              .select("id", { count: "exact", head: true })
              .eq("profile_id", userId)
              .gt("created_at", trackedSinceDate),
            supabase
              .from("notification_events")
              .select("id", { count: "exact", head: true })
              .eq("profile_id", userId)
              .in("status", ["pending", "processing"]),
          ])
        : [{ data: [] as Array<{ amount: number }> }, { count: 0 }, { count: 0 }, { count: 0 }];

    const auraDeltaSinceTracked = trackedSinceDate
      ? (((transactionsSinceTrackedResult.data as Array<{ amount: number }> | null) || []) as Array<{ amount: number }>).reduce(
          (sum, row) => sum + Number(row.amount || 0),
          0,
        )
      : 0;
    const newMomentsSinceTracked = trackedSinceDate ? Number(momentsSinceTrackedResult.count || 0) : 0;
    const pendingEvents = trackedSinceDate ? Number(pendingEventsResult.count || 0) : 0;
    const newAchievementsSinceTracked = trackedSinceDate ? Number(achievementsSinceTrackedResult.count || 0) : 0;
    const activatedReferralsSinceTracked = trackedSinceDate
      ? referrals.filter((entry) => entry.activatedAt && entry.activatedAt > trackedSinceDate).length
      : 0;

    return (
      <>
        <ProfileRaceCard raceContext={raceContext} weeklyTitles={weeklyTitles} auraPoints={auraPoints} dailyStreak={dailyStreak} />

        <ReturnPulseCard
          trackedAt={trackedAt}
          currentRank={raceContext?.rank ?? null}
          previousRank={presenceState?.last_rank ?? null}
          auraDelta={auraDeltaSinceTracked}
          newAchievements={newAchievementsSinceTracked}
          newMoments={newMomentsSinceTracked}
          activatedReferrals={activatedReferralsSinceTracked}
          pendingEvents={pendingEvents}
        />
      </>
    );
  }

  if (activeTab === "circle") {
    const shareableMomentsResult = await supabase
      .from("shareable_moments")
      .select("id, moment_type, payload, created_at")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    const circleIds = Array.from(
      new Set([userId, ...(referredById ? [referredById] : []), ...referrals.map((entry) => entry.inviteeId)]),
    );
    const circleProfilesResult = circleIds.length
      ? await supabase.from("profiles").select("id, username, display_name, aura_points").in("id", circleIds)
      : { data: [] as CircleProfileRow[] };

    const circleProfiles = ((circleProfilesResult.data as CircleProfileRow[] | null) || [])
      .map((row) => {
        let relation: "you" | "invited" | "invited_you" = "invited";
        let relationLabel = "твой человек";

        if (row.id === userId) {
          relation = "you";
          relationLabel = "это ты";
        } else if (referredById && row.id === referredById) {
          relation = "invited_you";
          relationLabel = "пригласил тебя";
        } else {
          const referral = referrals.find((entry) => entry.inviteeId === row.id);
          relationLabel =
            referral?.status === "activated"
              ? "ты пригласил, петля уже закрылась"
              : referral?.hasFirstClaim
                ? "ты пригласил, ждём активность"
                : "ты пригласил, ждём первый вход";
        }

        return {
          id: row.id,
          username: row.username,
          displayName: row.display_name || row.username,
          auraPoints: Number(row.aura_points || 0),
          relation,
          relationLabel,
        };
      })
      .sort((left, right) => right.auraPoints - left.auraPoints)
      .slice(0, 6);

    const activatedInvites = referrals.filter((entry) => entry.status === "activated").length;
    const pendingInvites = referrals.filter((entry) => entry.status === "pending").length;

    return (
      <>
        <MyCircleCard circleProfiles={circleProfiles} activatedInvites={activatedInvites} pendingInvites={pendingInvites} />
        <InviteLoopCard
          inviteCode={inviteCode}
          webInviteLink={inviteLink}
          telegramInviteLink={telegramInviteLink}
          referrals={referrals}
        />
        <ShareableMomentsCard
          moments={(shareableMomentsResult.data as ShareableMomentRow[] | null) || []}
          username={profileUsername}
          displayName={displayName}
          profileShareLink={profileShareLink}
          inviteLink={inviteLink}
        />
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/20 p-4">
          <CopyLink link={profileShareLink} />
          <ShareButton username={profileUsername} />
        </div>
      </>
    );
  }

  const nowIso = new Date().toISOString();
  const [spotlightResult, auraLeadersResult, growthLeadersResult, transactionsResult, reengagementEventsResult] = await Promise.all([
    supabase
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(5),
    supabase.from("profiles").select("id, username, display_name, aura_points").order("aura_points", { ascending: false }).limit(5),
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

  return (
    <>
      <ReengagementEventsCard events={(reengagementEventsResult.data as NotificationEventRow[] | null) || []} />
      <LeaderboardPreview auraLeaders={auraLeaders} growthLeaders={growthLeaders} spotlightLeaders={spotlightLeaders} currentUserId={userId} />
      <AuraTransactions transactions={transactionsResult.data || []} />
    </>
  );
}
