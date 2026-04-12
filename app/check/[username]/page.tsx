import AuraCard from "@/components/AuraCard";
import Background from "@/components/Background";
import { VOTE_PAIR_COOLDOWN_HOURS } from "@/lib/economy";
import { getProfileModerationState, isProfileLimited } from "@/lib/server/profile-moderation";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CheckPageNav from "./CheckPageNav";

interface CheckPageProps {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    returnTo?: string;
  }>;
}

interface AuraEffectRow {
  effect_type: "DECAY_SHIELD" | "CARD_ACCENT";
  effect_variant: string | null;
  expires_at: string;
}

export default async function CheckPage({ params, searchParams }: CheckPageProps) {
  const { username } = await params;
  const { returnTo } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const isAuthorizedUser = Boolean(currentUser && !currentUser.is_anonymous);
  const backFallback: "/" | "/profile" | "/leaderboard" | "/discover" =
    returnTo === "profile" && isAuthorizedUser
      ? "/profile"
      : returnTo === "leaderboard"
        ? "/leaderboard"
        : returnTo === "discover"
          ? "/discover"
          : "/";
  let canManageSpecialCard = false;

  if (isAuthorizedUser) {
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    canManageSpecialCard = Boolean(isAdmin);
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("username", username).single();

  if (!profile) {
    notFound();
  }

  const moderationState = await getProfileModerationState(profile.id);
  const isOwner = currentUser?.id === profile.id;
  if (isProfileLimited(moderationState) && !canManageSpecialCard && !isOwner) {
    notFound();
  }

  const nowIso = new Date().toISOString();

  const existingVotePromise = currentUser
    ? supabase
        .from("votes")
        .select("id, created_at")
        .eq("voter_id", currentUser.id)
        .eq("target_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null as { id: string; created_at: string } | null, error: null });

  const [votesUpResult, votesDownResult, existingVoteResult, activeBoostResult, activeEffectsResult] = await Promise.all([
    supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("target_id", profile.id)
      .eq("vote_type", "up"),
    supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("target_id", profile.id)
      .eq("vote_type", "down"),
    existingVotePromise,
    supabase
      .from("boosts")
      .select("expires_at")
      .eq("profile_id", profile.id)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("aura_effects")
      .select("effect_type, effect_variant, expires_at")
      .eq("profile_id", profile.id)
      .gt("expires_at", nowIso),
  ]);

  const latestVoteAt = existingVoteResult.data?.created_at ?? null;
  const voteCooldownUntil = latestVoteAt
    ? new Date(new Date(latestVoteAt).getTime() + VOTE_PAIR_COOLDOWN_HOURS * 60 * 60 * 1000)
    : null;
  const nowMs = new Date(nowIso).getTime();
  const hasVoted = Boolean(voteCooldownUntil && voteCooldownUntil.getTime() > nowMs);
  const activeEffects = (activeEffectsResult.data as AuraEffectRow[] | null) || [];
  const decayShieldUntil = activeEffects.find((effect) => effect.effect_type === "DECAY_SHIELD")?.expires_at ?? null;
  const activeCardAccent = activeEffects.find((effect) => effect.effect_type === "CARD_ACCENT");

  return (
    <div className="min-h-screen bg-background text-white font-unbounded relative overflow-hidden">
      <Background />

      <div className="smart-container px-6 pt-16">
        <header className="text-center mb-12">
          <div className="mb-6 flex justify-center">
            <CheckPageNav isAuthorized={isAuthorizedUser} backFallback={backFallback} />
          </div>

          <h1 className="text-2xl font-bold mb-2 uppercase italic tracking-tighter">Проверка карточки</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Оцени профиль и отдай голос</p>
        </header>

        <main className="flex flex-col items-center gap-10">
          <AuraCard
            username={profile.username}
            displayName={profile.display_name || profile.username}
            avatarUrl={profile.avatar_url}
            auraPoints={profile.aura_points}
            totalVotesUp={votesUpResult.count || 0}
            totalVotesDown={votesDownResult.count || 0}
            profileId={profile.id}
            isOwner={isOwner}
            status={profile.status}
            specialCard={profile.special_card}
            canManageSpecialCard={canManageSpecialCard}
            hasVoted={hasVoted}
            voteCooldownUntil={hasVoted && voteCooldownUntil ? voteCooldownUntil.toISOString() : null}
            spotlightUntil={activeBoostResult.data?.expires_at ?? null}
            decayShieldUntil={decayShieldUntil}
            cardAccent={activeCardAccent?.effect_variant ?? null}
            cardAccentUntil={activeCardAccent?.expires_at ?? null}
          />
        </main>
      </div>
    </div>
  );
}
