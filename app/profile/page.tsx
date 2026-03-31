import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuraCard from "@/components/AuraCard";
import AuraTransactions from "@/components/AuraTransactions";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";
import { headers } from "next/headers";
import CopyLink from "./CopyLink";
import Background from "@/components/Background";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // 1. Проверяем буст
  const { data: boost } = await supabase
    .from("boosts")
    .select("id")
    .eq("profile_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  // 2. Считаем голоса
  const { count: votesUp } = await supabase
    .from("votes")
    .select("*", { count: 'exact', head: true })
    .eq("target_id", user.id)
    .eq("vote_type", "up");

  const { count: votesDown } = await supabase
    .from("votes")
    .select("*", { count: 'exact', head: true })
    .eq("target_id", user.id)
    .eq("vote_type", "down");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, amount, type, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-background text-white font-unbounded relative overflow-hidden">
      <Background />
      
      <div className="smart-container px-6 pt-6">
        <header className="flex justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-none">Профиль</h1>
          <nav className="flex items-center gap-1.5">
            <Link
              href="/"
              className="px-3 py-2 rounded-xl border border-white/20 text-[10px] font-black uppercase tracking-[0.15em] text-white/70 hover:text-white hover:bg-white/5 transition-all active:scale-95"
            >
              Домой
            </Link>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="px-3 py-2 rounded-xl border border-neon-pink/30 text-[10px] font-black uppercase tracking-[0.15em] text-neon-pink/80 hover:text-neon-pink hover:bg-neon-pink/10 transition-all active:scale-95"
              >
                Выйти
              </button>
            </form>
          </nav>
        </header>

        <main className="flex flex-col items-center gap-6 pb-12">
          <AuraCard
            username={profile.username}
            displayName={profile.display_name || profile.username}
            avatarUrl={profile.avatar_url}
            auraPoints={profile.aura_points}
            totalVotesUp={votesUp || 0}
            totalVotesDown={votesDown || 0}
            profileId={profile.id}
            isOwner={true}
            status={profile.status}
            isBoosted={!!boost}
          />

          <AuraTransactions transactions={transactions || []} />

          <div className="w-full flex flex-col items-center space-y-6 pb-20">
            <CopyLink link={`${origin}/check/${profile.username}`} />
            <ShareButton username={profile.username} />
          </div>
        </main>
      </div>
    </div>
  );
}
