import AuraCard from "@/components/AuraCard";
import AuraSpendActionsCard from "@/components/AuraSpendActionsCard";
import Background from "@/components/Background";
import DailyRewardCard from "@/components/DailyRewardCard";
import InviteLoopCard from "@/components/InviteLoopCard";
import ShareButton from "@/components/ShareButton";
import { getDailyRewardStatus, getStreakRescueStatus } from "@/lib/economy";
import { drainPendingNotificationQueue } from "@/lib/server/notification-delivery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CopyLink from "./CopyLink";
import ProfileSecondaryPanels from "./ProfileSecondaryPanels";

interface AuraEffectRow {
  effect_type: "DECAY_SHIELD" | "CARD_ACCENT";
  effect_variant: string | null;
  expires_at: string;
}

function ProfileSecondaryFallback() {
  return (
    <>
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Подгружаем гонку и события</p>
      </section>
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Подгружаем историю ауры</p>
      </section>
    </>
  );
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

  if (!profile.invite_code) {
    const { data: inviteCode } = await supabase.rpc("ensure_profile_invite_code", { p_profile_id: user.id });
    if (inviteCode) {
      profile.invite_code = inviteCode;
    }
  }

  after(async () => {
    try {
      const admin = createAdminClient();
      const { error } = await admin.rpc("sync_leaderboard_presence_event", { p_profile_id: user.id });

      if (error) {
        console.error("[Profile Page] Failed to sync leaderboard presence", error.message);
      }

      const weeklyMomentsResult = await admin.rpc("emit_active_weekly_title_moments");
      if (weeklyMomentsResult.error) {
        console.error("[Profile Page] Failed to emit weekly title moments", weeklyMomentsResult.error.message);
      }

      await drainPendingNotificationQueue(4);
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
    pendingInvitesResult,
    activatedInvitesResult,
  ] =
    await Promise.all([
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
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("inviter_id", user.id).eq("status", "pending"),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("inviter_id", user.id).eq("status", "activated"),
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
  const pendingInvites = Number(pendingInvitesResult.count || 0);
  const activatedInvites = Number(activatedInvitesResult.count || 0);
  const inviteCode = typeof profile.invite_code === "string" ? profile.invite_code : null;
  const webInviteLink = inviteCode ? `${origin}/login?ref=${encodeURIComponent(inviteCode)}` : null;
  const telegramInviteLink =
    inviteCode && process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME
      ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME}?startapp=${encodeURIComponent(`ref_${inviteCode}`)}`
      : null;

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

          <Suspense fallback={<ProfileSecondaryFallback />}>
            <ProfileSecondaryPanels userId={user.id} />
          </Suspense>

          <div className="w-full flex flex-col items-center space-y-6 pb-20">
            <InviteLoopCard
              inviteCode={inviteCode}
              webInviteLink={webInviteLink}
              telegramInviteLink={telegramInviteLink}
              pendingCount={pendingInvites}
              activatedCount={activatedInvites}
            />
            <CopyLink link={`${origin}/check/${profile.username}`} />
            <ShareButton username={profile.username} />
          </div>
        </main>
      </div>
    </div>
  );
}
