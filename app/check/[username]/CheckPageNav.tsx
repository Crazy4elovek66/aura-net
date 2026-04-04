"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface CheckPageNavProps {
  isAuthorized: boolean;
  backFallback: "/" | "/profile" | "/leaderboard" | "/discover";
}

export default function CheckPageNav({ isAuthorized, backFallback }: CheckPageNavProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(backFallback);
  };

  return (
    <nav className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md p-2 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={handleBack}
        className="px-3 py-2 rounded-xl border border-white/20 text-[10px] font-black uppercase tracking-[0.15em] text-white/70 hover:text-white hover:bg-white/5 transition-all active:scale-95"
      >
        Назад
      </button>

      <Link
        href="/"
        className="px-3 py-2 rounded-xl border border-white/20 text-[10px] font-black uppercase tracking-[0.15em] text-white/70 hover:text-white hover:bg-white/5 transition-all active:scale-95"
      >
        Главная
      </Link>

      {isAuthorized ? (
        <Link
          href="/profile"
          className="px-3 py-2 rounded-xl border border-neon-purple/30 text-[10px] font-black uppercase tracking-[0.15em] text-neon-purple/90 hover:text-neon-purple hover:bg-neon-purple/10 transition-all active:scale-95"
        >
          Мой профиль
        </Link>
      ) : (
        <Link
          href="/login"
          className="px-3 py-2 rounded-xl border border-neon-purple/30 text-[10px] font-black uppercase tracking-[0.15em] text-neon-purple/90 hover:text-neon-purple hover:bg-neon-purple/10 transition-all active:scale-95"
        >
          Войти
        </Link>
      )}
    </nav>
  );
}
