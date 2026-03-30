import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AuraCard from "@/components/AuraCard";
import VoteButtons from "@/components/VoteButtons";
import { motion } from "framer-motion";
import Background from "@/components/Background";

interface CheckPageProps {
  params: {
    username: string;
  };
}

export default async function CheckPage({ params }: CheckPageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // Получаем текущего юзера
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Ищем профиль цели
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) {
    notFound();
  }

  // Считаем голоса
  const { count: votesUp } = await supabase
    .from("votes")
    .select("*", { count: 'exact', head: true })
    .eq("target_id", profile.id)
    .eq("vote_type", "up");

  const { count: votesDown } = await supabase
    .from("votes")
    .select("*", { count: 'exact', head: true })
    .eq("target_id", profile.id)
    .eq("vote_type", "down");

  return (
    <div className="min-h-screen bg-background text-white font-unbounded relative overflow-hidden">
      <Background />

      <div className="smart-container px-6 pt-16">
        <header className="text-center mb-12">
          <h1 className="text-2xl font-bold mb-2 uppercase italic tracking-tighter">Чекаем вайб</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">В чьи-то руки попала власть... ⚡</p>
        </header>

        <main className="flex flex-col items-center gap-10">
          <AuraCard
            username={profile.username}
            displayName={profile.display_name || profile.username}
            avatarUrl={profile.avatar_url}
            auraPoints={profile.aura_points}
            totalVotesUp={votesUp || 0}
            totalVotesDown={votesDown || 0}
            profileId={profile.id}
            isOwner={currentUser?.id === profile.id}
          />

        </main>
      </div>
    </div>
  );
}
