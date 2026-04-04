"use client";

import { useState } from "react"; 

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface VoteButtonsProps {
  targetId: string;
  isLoggedIn: boolean;
  canVote: boolean;
}

export default function VoteButtons({ targetId, isLoggedIn, canVote }: VoteButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const [aiComment, setAiComment] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Сеть приуныла";

  const handleVote = async (type: "up" | "down") => {
    setLoading(true);
    
    try {
      // 1. Если не залогинен — входим анонимно
      if (!isLoggedIn) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
      }

      // 2. Голосуем
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, type }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setVoted(true);
        setAiComment(data.comment || "Вайб-чек пройден! Ты изменил историю этого профиля. 🔥");
        router.refresh(); 
      } else {
        alert(data.error || "Что-то пошло не так...");
      }
    } catch (err: unknown) {
      alert("Ошибка: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!canVote && isLoggedIn) {
    return (
      <p className="text-muted text-sm italic">
        Ты не можешь голосовать за самого себя. Это база. 🫡
      </p>
    );
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
              onClick={() => handleVote("up")}
              disabled={loading}
              className="group flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-neon-green/20 bg-neon-green/5 hover:bg-neon-green/10 transition-all"
            >
              <span className="text-4xl group-hover:scale-125 transition-transform">🔥</span>
              <span className="text-xs font-bold text-neon-green uppercase tracking-widest">
                +АУРА
              </span>
            </button>

            <button
              onClick={() => handleVote("down")}
              disabled={loading}
              className="group flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-neon-pink/20 bg-neon-pink/5 hover:bg-neon-pink/10 transition-all"
            >
              <span className="text-4xl group-hover:scale-125 transition-transform">💀</span>
              <span className="text-xs font-bold text-neon-pink uppercase tracking-widest">
                −АУРА
              </span>
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
                  🤖
                </div>
                <div>
                  <p className="text-xs font-bold text-neon-purple uppercase mb-1">ИИ-Вердикт</p>
                  <p className="text-sm italic text-foreground leading-relaxed">
                    &quot;{aiComment}&quot;
                  </p>
                </div>
              </div>
            </div>

            <Link 
              href="/login"
              className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-neon-purple to-neon-pink text-white text-center shadow-lg shadow-neon-purple/20 hover:scale-[1.02] transition-transform"
            >
              УЗНАТЬ СВОЮ АУРУ ⚡
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
