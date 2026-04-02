import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AuraCard from "@/components/AuraCard";
import Background from "@/components/Background";
import CheckPageNav from "./CheckPageNav";

interface CheckPageProps {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    returnTo?: string;
  }>;
}

export default async function CheckPage({ params, searchParams }: CheckPageProps) {
  const { username } = await params;
  const { returnTo } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const isAuthorizedUser = Boolean(currentUser && !currentUser.is_anonymous);
  const backFallback: "/" | "/profile" = returnTo === "profile" && isAuthorizedUser ? "/profile" : "/";
  let canManageSpecialCard = false;

  if (isAuthorizedUser) {
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    canManageSpecialCard = Boolean(isAdmin);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) {
    notFound();
  }

  const existingVotePromise = currentUser
    ? supabase
        .from("votes")
        .select("id")
        .eq("voter_id", currentUser.id)
        .eq("target_id", profile.id)
        .maybeSingle()
    : Promise.resolve({ data: null as { id: string } | null, error: null });

  const [votesUpResult, votesDownResult, existingVoteResult] = await Promise.all([
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
  ]);

  const hasVoted = Boolean(existingVoteResult.data);

  return (
    <div className="min-h-screen bg-background text-white font-unbounded relative overflow-hidden">
      <Background />

      <div className="smart-container px-6 pt-16">
        <header className="text-center mb-12">
          <div className="mb-6 flex justify-center">
            <CheckPageNav isAuthorized={isAuthorizedUser} backFallback={backFallback} />
          </div>

          <h1 className="text-2xl font-bold mb-2 uppercase italic tracking-tighter">Чекаем вайб</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">В чьи-то руки попала власть... ⚡</p>
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
            isOwner={currentUser?.id === profile.id}
            status={profile.status}
            specialCard={profile.special_card}
            canManageSpecialCard={canManageSpecialCard}
            hasVoted={hasVoted}
          />
        </main>
      </div>
    </div>
  );
}
