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
  const supabase = createClient();
  const { notify } = useNotice();

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Сеть временно недоступна";

  const formatCooldownTime = (value: unknown): string | null => {
    if (typeof value !== "string" || !value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("ru-RU");
  };

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
        body: JSON.stringify({ targetId, type }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        comment?: string;
        error?: string;
        nextAvailableAt?: string | null;
      };

      if (res.ok) {
        setVoted(true);
        setAiComment(data.comment || "Вайб-чек пройден. Ты изменил историю этого профиля.");
      } else {
        const nextAvailableAtText = formatCooldownTime(data.nextAvailableAt);
        notify({
          variant: "error",
          title: "Голос не отправлен",
          message: nextAvailableAtText
            ? `${data.error || "Что-то пошло не так."} Следующий голос будет доступен: ${nextAvailableAtText}.`
            : data.error || "Что-то пошло не так.",
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
            className="grid grid-cols-2 gap-4"
          >
            <button
              type="button"
              onClick={() => handleVote("up")}
              disabled={loading}
              className="group flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-neon-green/20 bg-neon-green/5 hover:bg-neon-green/10 transition-all disabled:opacity-60"
            >
              <span className="text-4xl group-hover:scale-125 transition-transform">??</span>
              <span className="text-xs font-bold text-neon-green uppercase tracking-widest">+АУРА</span>
            </button>

            <button
              type="button"
              onClick={() => handleVote("down")}
              disabled={loading}
              className="group flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-neon-pink/20 bg-neon-pink/5 hover:bg-neon-pink/10 transition-all disabled:opacity-60"
            >
              <span className="text-4xl group-hover:scale-125 transition-transform">??</span>
              <span className="text-xs font-bold text-neon-pink uppercase tracking-widest">?АУРА</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            <div className="neo-card p-6 rounded-2xl border-2 border-neon-purple shadow-lg shadow-neon-purple/20 bg-card/80">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-neon-purple/20 flex items-center justify-center flex-shrink-0 text-xl">
                  ??
                </div>
                <div>
                  <p className="text-xs font-bold text-neon-purple uppercase mb-1">ИИ-вердикт</p>
                  <p className="text-sm italic text-foreground leading-relaxed">&quot;{aiComment}&quot;</p>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-neon-purple to-neon-pink text-white text-center shadow-lg shadow-neon-purple/20 hover:scale-[1.02] transition-transform"
            >
              Узнать свою ауру
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

