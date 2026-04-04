import Background from "@/components/Background";
import LeaderboardHub from "@/components/LeaderboardHub";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
            href={user ? "/profile" : "/login"}
            className="px-4 py-2 rounded-lg border border-neon-purple/50 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 transition-all text-sm font-medium"
          >
            {user ? "Профиль" : "Войти"}
          </Link>
        </div>
      </nav>

      <div className="smart-container px-6 pt-20">
        <header className="mb-8 pt-2">
          <div>
            <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-[1.2]">Гонка ауры</h1>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45 mt-2">Живая гонка ауры и роста</p>
          </div>
        </header>

        <main className="pb-12">
          <LeaderboardHub />
        </main>
      </div>
    </div>
  );
}
