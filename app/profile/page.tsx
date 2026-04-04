import AuraCard from "@/components/AuraCard";
import AuraSpendActionsCard from "@/components/AuraSpendActionsCard";
import AuraTransactions from "@/components/AuraTransactions";
import Background from "@/components/Background";
import DailyRewardCard from "@/components/DailyRewardCard";
import LeaderboardPreview from "@/components/LeaderboardPreview";
import ProfileRaceCard from "@/components/ProfileRaceCard";
import ReengagementEventsCard from "@/components/ReengagementEventsCard";
import { getDailyRewardStatus, getStreakRescueStatus } from "@/lib/economy";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import ShareButton from "@/components/ShareButton";
import CopyLink from "./CopyLink";

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

interface AuraEffectRow {
  effect_type: "DECAY_SHIELD" | "CARD_ACCENT";
  effect_variant: string | null;
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
}

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

export default async function ProfilePage() {
  const supabase = await createClient();
  const host = (await headers()).get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("apply_daily_decay", { p_profile_id: user.id });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) {
    redirect("/login");
  }

  const nowIso = new Date().toISOString();
  const nowDate = new Date();
  const utcWeekDay = (nowDate.getUTCDay() + 6) % 7;
  const weekStart = new Date(
    Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() - utcWeekDay),
  );
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dailyRewardState = getDailyRewardStatus(profile.daily_streak, profile.last_reward_at);
  const streakRescueStatus = getStreakRescueStatus(
    profile.daily_streak,
    profile.last_reward_at,
    profile.last_streak_save_at ?? null,
  );

  const leaderboardSyncResult = await supabase.rpc("sync_leaderboard_presence_event", { p_profile_id: user.id });
  if (leaderboardSyncResult.error) {
    console.error("[Profile Page] Failed to sync leaderboard presence", leaderboardSyncResult.error.message);
  }

  const [
    boostResult,
    auraEffectsResult,
    spotlightResult,
    votesUpResult,
    votesDownResult,
    transactionsResult,
    auraLeadersResult,
    growthLeadersResult,
    adminCheckResult,
    weeklyRewardDaysResult,
    reengagementEventsResult,
    raceContextResult,
    weeklyTitlesResult,
  ] = await Promise.all([
    supabase
      .from("boosts")
      .select("expires_at")
      .eq("profile_id", user.id)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("aura_effects")
      .select("effect_type, effect_variant, expires_at")
      .eq("profile_id", user.id)
      .gt("expires_at", nowIso),
    supabase
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(5),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", user.id)
      .eq("vote_type", "up"),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", user.id)
      .eq("vote_type", "down"),
    supabase
      .from("transactions")
      .select("id, amount, type, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("id, username, display_name, aura_points")
      .order("aura_points", { ascending: false })
      .limit(5),
    supabase.rpc("get_growth_leaderboard", { p_days: 7, p_limit: 5 }),
    supabase.rpc("is_platform_admin"),
    supabase
      .from("transactions")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_reward")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString()),
    supabase
      .from("notification_events")
      .select("id, event_type, status, created_at, scheduled_for")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.rpc("get_profile_leaderboard_context", { p_profile_id: user.id, p_top_target: 10 }).maybeSingle(),
    supabase.rpc("get_active_weekly_titles", { p_limit: 12 }),
  ]);

  const activeEffects = (auraEffectsResult.data as AuraEffectRow[] | null) || [];
  const decayShieldUntil = activeEffects.find((effect) => effect.effect_type === "DECAY_SHIELD")?.expires_at ?? null;
  const activeCardAccent = activeEffects.find((effect) => effect.effect_type === "CARD_ACCENT");
  const cardAccent = activeCardAccent?.effect_variant ?? null;
  const cardAccentUntil = activeCardAccent?.expires_at ?? null;

  const spotlightRows = (spotlightResult.data as SpotlightRow[] | null) || [];
  const uniqueSpotlightRows = Array.from(
    new Map(spotlightRows.map((row) => [row.profile_id, row])).values(),
  );
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

  const canManageSpecialCard = Boolean(adminCheckResult.data);
  const spotlightUntil = boostResult.data?.expires_at ?? null;
  const weeklyRewardDays = new Set(
    (weeklyRewardDaysResult.data || []).map((row) => new Date(row.created_at).toISOString().slice(0, 10)),
  ).size;

  if (raceContextResult.error) {
    console.error("[Profile Page] Failed to load race context", raceContextResult.error.message);
  }

  if (weeklyTitlesResult.error) {
    console.error("[Profile Page] Failed to load weekly titles", weeklyTitlesResult.error.message);
  }

  const raceContextRaw = (raceContextResult.data || null) as ProfileLeaderboardContextRow | null;
  let raceContext:
    | {
        profileId: string;
        rank: number;
        distanceToNext: number;
        distanceToTop10: number;
        above: { id: string; username: string; displayName: string; auraPoints: number } | null;
        below: { id: string; username: string; displayName: string; auraPoints: number } | null;
      }
    | null = null;

  if (raceContextRaw) {
    raceContext = {
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
    };
  }

  const weeklyTitles = ((weeklyTitlesResult.data as WeeklyTitleRow[] | null) || [])
    .filter((row) => row.profile_id === user.id)
    .map((row) => ({
      key: row.title_key,
      title: WEEKLY_TITLE_LABELS[row.title_key] || row.title,
    }));

  return (
    <div className="min-h-screen bg-background text-white font-unbounded relative overflow-hidden">
      <Background />

      <nav className="sticky top-0 z-[150] px-6 py-3 flex justify-between items-center bg-background/50 backdrop-blur-md border-b border-card-border">
        <Link href="/" className="text-xl font-bold tracking-tighter">
          <span className="text-neon-purple">AURA</span>
          <span className="text-white/70">.NET</span>
        </Link>
        <div className="flex gap-2 sm:gap-4">
          <Link
            href="/leaderboard"
            className="px-3 py-2 rounded-lg border border-card-border hover:border-neon-purple transition-all text-xs sm:text-sm font-medium text-white/70 hover:text-white"
          >
            Гонка ауры
          </Link>
          <Link
            href="/discover"
            className="px-3 py-2 rounded-lg border border-card-border hover:border-neon-purple transition-all text-xs sm:text-sm font-medium text-white/70 hover:text-white"
          >
            Разведка
          </Link>
          <Link
            href="/profile"
            className="px-4 py-2 rounded-lg border border-neon-purple/50 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 transition-all text-sm font-medium"
          >
            Профиль
          </Link>
        </div>
      </nav>

      <div className="smart-container px-6 pt-20">
        <header className="flex justify-between items-center mb-8 gap-4 pt-2">
          <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-[1.2]">Профиль</h1>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="px-3 py-2 rounded-xl border border-neon-pink/30 text-[10px] font-black uppercase tracking-[0.15em] text-neon-pink/80 hover:text-neon-pink hover:bg-neon-pink/10 transition-all active:scale-95"
            >
              Выйти
            </button>
          </form>
        </header>

        <main className="flex flex-col items-center gap-6 pb-12">
          <AuraCard
            username={profile.username}
            displayName={profile.display_name || profile.username}
            avatarUrl={profile.avatar_url}
            auraPoints={profile.aura_points}
            totalVotesUp={votesUpResult.count || 0}
            totalVotesDown={votesDownResult.count || 0}
            profileId={profile.id}
            isOwner={true}
            status={profile.status}
            specialCard={profile.special_card}
            canManageSpecialCard={canManageSpecialCard}
            spotlightUntil={spotlightUntil}
            decayShieldUntil={decayShieldUntil}
            cardAccent={cardAccent}
            cardAccentUntil={cardAccentUntil}
          />

          <DailyRewardCard
            initialState={{
              canClaim: dailyRewardState.canClaim,
              claimedToday: dailyRewardState.claimedToday,
              streak: profile.daily_streak,
              rewardToday: dailyRewardState.rewardToday,
              nextReward: dailyRewardState.nextReward,
              availableAt: dailyRewardState.availableAt,
              streakWillReset: dailyRewardState.streakWillReset,
              projectedStreak: dailyRewardState.projectedStreak,
              weeklyProgressDays: weeklyRewardDays,
              weeklyTargetDays: 5,
            }}
          />

          <ProfileRaceCard raceContext={raceContext} weeklyTitles={weeklyTitles} />

          <ReengagementEventsCard events={(reengagementEventsResult.data as NotificationEventRow[] | null) || []} />

          <AuraSpendActionsCard
            profileId={profile.id}
            initialState={{
              streak: Number(profile.daily_streak || 0),
              decayShieldUntil,
              spotlightUntil,
              cardAccent,
              cardAccentUntil,
              canRescueStreak: streakRescueStatus.canRescue,
              rescueAvailableAt: streakRescueStatus.availableAt,
            }}
          />

          <LeaderboardPreview
            auraLeaders={auraLeaders}
            growthLeaders={growthLeaders}
            spotlightLeaders={spotlightLeaders}
            currentUserId={user.id}
          />

          <AuraTransactions transactions={transactionsResult.data || []} />

          <div className="w-full flex flex-col items-center space-y-6 pb-20">
            <CopyLink link={`${origin}/check/${profile.username}`} />
            <ShareButton username={profile.username} />
          </div>
        </main>
      </div>
    </div>
  );
}

