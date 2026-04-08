"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useNotice } from "@/components/notice/NoticeProvider";

interface VoteButtonsProps {
  targetId: string;
  isLoggedIn: boolean;
  canVote: boolean;
}

export default function VoteButtons({ targetId, isLoggedIn, canVote }: VoteButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const [aiComment, setAiComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const supabase = createClient();
  const { notify } = useNotice();

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Сеть временно недоступна";

  const handleVote = async (type: "up" | "down") => {
    if (loading) return;

    setLoading(true);

    try {
      if (!isLoggedIn) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
      }

      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, type, isAnonymous }),
      });

      const data = (await res.json().catch(() => ({}))) as { comment?: string; error?: string };

      if (res.ok) {
        setVoted(true);
        setAiComment(data.comment || "Вайб-чек пройден. Ты изменил историю этого профиля.");
      } else {
        notify({
          variant: "error",
          title: "Голос не отправлен",
          message: data.error || "Что-то пошло не так.",
        });
      }
    } catch (err: unknown) {
      notify({
        variant: "error",
        title: "Ошибка голосования",
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canVote && isLoggedIn) {
    return <p className="text-muted text-sm italic">Ты не можешь голосовать за самого себя.</p>;
  }

  return (
    <div className="w-full max-w-sm">
      <AnimatePresence mode="wait">
        {!voted ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col gap-6"
          >
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest">Анонимно</span>
                <span className="text-[8px] text-muted uppercase">Налог: -50 ауры</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymous((current) => !current)}
                disabled={loading}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${isAnonymous ? "bg-neon-purple" : "bg-white/10"}`}
              >
                <motion.div animate={{ x: isAnonymous ? 24 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-lg" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleVote("up")}
                disabled={loading}
                className="group flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-neon-green/20 bg-neon-green/5 hover:bg-neon-green/10 transition-all active:scale-95 disabled:opacity-60"
              >
                <span className="text-4xl group-hover:scale-125 transition-transform">🔥</span>
                <span className="text-xs font-black text-neon-green uppercase tracking-[0.2em]">АУРА+</span>
              </button>

              <button
                type="button"
                onClick={() => handleVote("down")}
                disabled={loading}
                className="group flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-neon-pink/20 bg-neon-pink/5 hover:bg-neon-pink/10 transition-all active:scale-95 disabled:opacity-60"
              >
                <span className="text-4xl group-hover:scale-125 transition-transform">💀</span>
                <span className="text-xs font-black text-neon-pink uppercase tracking-[0.2em]">АУРА-</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            <div className="neo-card p-6 rounded-3xl border-2 border-neon-purple shadow-[0_0_20px_rgba(180,74,255,0.2)] bg-black/60 backdrop-blur-xl">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-2xl bg-neon-purple text-black flex items-center justify-center flex-shrink-0 text-xl font-black">
                  🤖
                </div>
                <div>
                  <p className="text-[10px] font-black text-neon-purple uppercase tracking-widest mb-1">ИИ-вердикт</p>
                  <p className="text-sm italic text-foreground leading-relaxed font-medium">&quot;{aiComment}&quot;</p>
                </div>
              </div>
            </div>

            <Link
              href="/profile"
              className="w-full py-4 rounded-2xl font-black bg-white text-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.05] transition-all text-center"
            >
              Моя аура
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
