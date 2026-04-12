import AuraCard from "@/components/AuraCard";
import AuraSpendActionsCard from "@/components/AuraSpendActionsCard";
import Background from "@/components/Background";
import DailyRewardCard from "@/components/DailyRewardCard";
import { getDailyRewardStatus, getStreakRescueStatus } from "@/lib/economy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  drainRuntimeReliabilityWork,
  scheduleInternalRuntimeDrain,
  shouldRunRuntimeTask,
} from "@/lib/server/runtime-reliability";
import { enqueueRuntimeJob } from "@/lib/server/runtime-jobs";
import { after } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileTabsNavigation from "./ProfileTabsNavigation";
import { normalizeProfileTab } from "./profile-tabs";

interface AuraEffectRow {
  effect_type: "DECAY_SHIELD" | "CARD_ACCENT";
  effect_variant: string | null;
  expires_at: string;
}

interface ReferralStatusRow {
  status: "pending" | "activated" | "rejected";
}

interface ProfilePageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

function ProfileHubSummary({
  auraPoints,
  dailyStreak,
  claimedToday,
  activatedInvites,
  pendingInvites,
}: {
  auraPoints: number;
  dailyStreak: number;
  claimedToday: boolean;
  activatedInvites: number;
  pendingInvites: number;
}) {
  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/72">Быстрый срез</h2>
          <p className="mt-1 text-[11px] text-white/52">
            Твой статус, награда дня и следующий шаг в одном месте.
          </p>
        </div>
        <div className="rounded-2xl border border-neon-purple/30 bg-neon-purple/10 px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Баланс</p>
          <p className="text-sm font-black text-neon-purple">{auraPoints}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Link href="/profile?tab=profile#daily-reward-card" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/50">Награда дня</p>
          <p className="mt-1 text-[12px] font-black text-white">
            {claimedToday ? "Награда уже забрана" : "Доступна награда"}
          </p>
          <p className="mt-1 text-[10px] text-white/52">Серия: {dailyStreak} дн.</p>
        </Link>
        <Link href="/profile?tab=progress" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/50">Маршрут</p>
          <p className="mt-1 text-[12px] font-black text-white">Цель, ранг и динамика</p>
          <p className="mt-1 text-[10px] text-white/52">Что делать дальше</p>
        </Link>
        <Link href="/profile?tab=circle" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/50">Круг</p>
          <p className="mt-1 text-[12px] font-black text-white">
            {activatedInvites > 0 ? `${activatedInvites} актив.` : "Отправь первый инвайт"}
          </p>
          <p className="mt-1 text-[10px] text-white/52">В ожидании: {pendingInvites}</p>
        </Link>
      </div>
    </section>
  );
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const activeTab = normalizeProfileTab(params.tab);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (shouldRunRuntimeTask(`profile-page:daily-decay:${user.id}`, 45_000)) {
    const { error: decayError } = await supabase.rpc("apply_daily_decay", { p_profile_id: user.id });
    if (decayError) {
      console.error("[Profile Page] Failed to apply daily decay", decayError.message);
    }
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.invite_code) {
    const { data: inviteCode } = await supabase.rpc("ensure_profile_invite_code", { p_profile_id: user.id });
    if (inviteCode) {
      profile.invite_code = inviteCode;
    }
  }

  after(async () => {
    try {
      if (!shouldRunRuntimeTask(`profile-page-after:${user.id}`, 45_000)) {
        return;
      }

      const admin = createAdminClient();
      let queuedFollowUp = false;
      const { error } = await admin.rpc("sync_leaderboard_presence_event", { p_profile_id: user.id });

      if (error) {
        console.error("[Profile Page] Failed to sync leaderboard presence", error.message);
        queuedFollowUp = true;
        await enqueueRuntimeJob({
          jobType: "sync_leaderboard_presence",
          dedupeKey: `profile-page:leaderboard:${user.id}`,
          payload: {
            profileId: user.id,
          },
        });
      }

      const weeklyMomentsResult = await admin.rpc("emit_active_weekly_title_moments");
      if (weeklyMomentsResult.error) {
        console.error("[Profile Page] Failed to emit weekly title moments", weeklyMomentsResult.error.message);
        queuedFollowUp = true;
        await enqueueRuntimeJob({
          jobType: "emit_weekly_title_moments",
          dedupeKey: `profile-page:weekly-moments:${user.id}:${new Date().toISOString().slice(0, 10)}`,
          payload: {
            profileId: user.id,
            source: "profile_page",
          },
        });
      }

      await drainRuntimeReliabilityWork({
        source: "profile-page-after",
        notificationLimit: 4,
        runtimeJobLimit: 4,
      });

      if (queuedFollowUp) {
        await scheduleInternalRuntimeDrain("profile-page-follow-up");
      }
    } catch (error) {
      console.error("[Profile Page] Failed to initialize admin client for leaderboard sync", error);
    }
  });

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

  const [
    boostResult,
    auraEffectsResult,
    votesUpResult,
    votesDownResult,
    adminCheckResult,
    weeklyRewardDaysResult,
    referralsStatusResult,
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
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", user.id)
      .eq("vote_type", "up"),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", user.id)
      .eq("vote_type", "down"),
    supabase.rpc("is_platform_admin"),
    supabase
      .from("transactions")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_reward")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString()),
    supabase.from("referrals").select("status").eq("inviter_id", user.id).limit(24),
  ]);

  const activeEffects = (auraEffectsResult.data as AuraEffectRow[] | null) || [];
  const decayShieldUntil = activeEffects.find((effect) => effect.effect_type === "DECAY_SHIELD")?.expires_at ?? null;
  const activeCardAccent = activeEffects.find((effect) => effect.effect_type === "CARD_ACCENT");
  const cardAccent = activeCardAccent?.effect_variant ?? null;
  const cardAccentUntil = activeCardAccent?.expires_at ?? null;
  const canManageSpecialCard = Boolean(adminCheckResult.data);
  const spotlightUntil = boostResult.data?.expires_at ?? null;
  const weeklyRewardDays = new Set(
    (weeklyRewardDaysResult.data || []).map((row) => new Date(row.created_at).toISOString().slice(0, 10)),
  ).size;

  const referralStatuses = (referralsStatusResult.data as ReferralStatusRow[] | null) || [];
  const pendingInvites = referralStatuses.filter((entry) => entry.status === "pending").length;
  const activatedInvites = referralStatuses.filter((entry) => entry.status === "activated").length;

  const profilePanel = (
    <>
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
      <ProfileHubSummary
        auraPoints={profile.aura_points}
        dailyStreak={profile.daily_streak}
        claimedToday={dailyRewardState.claimedToday}
        activatedInvites={activatedInvites}
        pendingInvites={pendingInvites}
      />
    </>
  );

  const shopPanel = (
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
  );

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
          <div className="flex items-center gap-2">
            {canManageSpecialCard ? (
              <Link
                href="/admin"
                className="inline-flex items-center rounded-xl border border-neon-green/25 bg-neon-green/8 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-neon-green/85 transition-all hover:border-neon-green/45 hover:bg-neon-green/14 hover:text-neon-green"
              >
                Admin / Ops
              </Link>
            ) : null}
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="px-3 py-2 rounded-xl border border-neon-pink/30 text-[10px] font-black uppercase tracking-[0.15em] text-neon-pink/80 hover:text-neon-pink hover:bg-neon-pink/10 transition-all active:scale-95"
              >
                Выйти
              </button>
            </form>
          </div>
        </header>

        <main className="flex flex-col items-center gap-6 pb-12">
          <ProfileTabsNavigation initialTab={activeTab} profilePanel={profilePanel} shopPanel={shopPanel} />
        </main>
      </div>
    </div>
  );
}
